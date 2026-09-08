/**
 * Executes a capture procedure against a connected rig: the only place a declared step
 * becomes serial traffic. Fitting is the sandbox's job and writing back the wizard's.
 */
import type { BenchInstrument } from "../instrument/interface";
import type { Logger } from "../utils/logger/logger";
import { defaultLogger } from "../utils/logger/logger";
import { ProcedureAborted, ProcedureDeclined, ProcedureRigError } from "./operator";
import type { OperatorPort, ProcedureProgress } from "./operator";
import { DUT_ROLE, SWEEP_STIMULUS_COLUMN, isInstrumentRead, isInstrumentStimulus } from "./types";
import type {
  CaptureProcedure,
  CaptureResult,
  InstrumentRead,
  MeasurementProtocol,
  ProcedureRead,
  ProcedureStep,
  ReadStep,
  SeriesCell,
  SeriesRow,
  SetpointValue,
  SweepStep,
} from "./types";

/** Deliberately not generic: a reading is narrowed by toCell, so a type parameter would only invite a cast. */
export interface ReadTarget {
  execute(
    command: string | object,
    options?: { timeoutMs?: number },
  ): Promise<{ success: boolean; data?: unknown; error?: Error }>;
}

export interface SetpointTarget {
  applySetpoint(name: string, value: number): Promise<void>;
}

/** What is plugged in, by declared role; a role may read, apply setpoints, or both. */
export interface RigBinding {
  read?: ReadTarget;
  setpoint?: SetpointTarget;
}

export interface ProcedureContext {
  /** Partial: a declared role may simply not be plugged in. */
  rig: Partial<Record<string, RigBinding>>;
  operator: OperatorPort;
  onProgress?: (event: ProcedureProgress) => void;
  logger?: Logger;
  /** Injected so tests do not wait out real settle times. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function runCaptureProcedure(
  procedure: CaptureProcedure,
  context: ProcedureContext,
): Promise<CaptureResult> {
  const runner = new ProcedureRunner(procedure, context);
  return runner.run();
}

class ProcedureRunner {
  private readonly payload: CaptureResult["payload"] = {};
  private readonly skipped: CaptureResult["skipped"] = [];
  private readonly log: Logger;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly procedure: CaptureProcedure,
    private readonly context: ProcedureContext,
  ) {
    this.log = context.logger ?? defaultLogger;
    this.sleep = context.sleep ?? realSleep;
  }

  async run(): Promise<CaptureResult> {
    this.assertRigDeclaresDut();

    const steps = this.procedure.steps;
    for (const [index, step] of steps.entries()) {
      this.report({
        kind: "step",
        index,
        total: steps.length,
        description: describeStep(step),
      });
      try {
        await this.runStep(step);
      } catch (error) {
        throw new ProcedureAborted(error instanceof Error ? error : new Error(String(error)), {
          payload: this.payload,
          skipped: this.skipped,
        });
      }
    }

    return { payload: this.payload, skipped: this.skipped };
  }

  private assertRigDeclaresDut(): void {
    if (!this.procedure.instruments.some((instrument) => instrument.role === DUT_ROLE)) {
      throw new ProcedureRigError(`The procedure does not declare the "${DUT_ROLE}" instrument`);
    }
  }

  private async runStep(step: ProcedureStep): Promise<void> {
    switch (step.kind) {
      case "operator": {
        const accepted = await this.context.operator.acknowledge(step.prompt, step.confirm);
        if (!accepted) throw new ProcedureDeclined(step.prompt);
        return;
      }
      case "settle":
        await this.sleep(step.ms);
        return;
      case "read":
        await this.runReadStep(step);
        return;
      case "sweep":
        await this.runSweepStep(step);
        return;
    }
  }

  private async runReadStep(step: ReadStep): Promise<void> {
    const unavailable = this.missingRole(step.read);
    if (unavailable) return this.skipOrFail(step, unavailable);

    if (step.prompt) {
      const accepted = await this.context.operator.acknowledge(step.prompt);
      if (!accepted) return this.skipOrFail(step, `operator declined: ${step.prompt}`);
    }

    const row = await this.takeReads(step.read);
    this.commit(step.series, [row]);
  }

  private async runSweepStep(step: SweepStep): Promise<void> {
    const unavailable =
      this.missingRole(step.read) ??
      (isInstrumentStimulus(step.stimulus)
        ? this.missingSetpointRole(step.stimulus.instrument)
        : undefined);
    if (unavailable) return this.skipOrFail(step, unavailable);

    const rows: SeriesRow[] = [];
    const values = step.stimulus.values;

    for (const [index, value] of values.entries()) {
      this.report({
        kind: "setpoint",
        series: step.series,
        index,
        total: values.length,
        value,
      });

      const applied = await this.applyStimulus(step, index);
      if (!applied) return this.skipOrFail(step, `operator declined a setpoint in ${step.series}`);

      if (step.settleMs) await this.sleep(step.settleMs);

      const row = await this.takeReads(step.read);
      row[SWEEP_STIMULUS_COLUMN] = value;
      rows.push(row);
    }

    this.commit(step.series, rows);
  }

  /** Read off the narrowed stimulus so an instrument value is a number by type. */
  private async applyStimulus(step: SweepStep, index: number): Promise<boolean> {
    if (!isInstrumentStimulus(step.stimulus)) {
      const value = step.stimulus.values[index];
      return this.context.operator.acknowledge(interpolate(step.stimulus.operator, value));
    }

    const target = this.context.rig[step.stimulus.instrument]?.setpoint;
    if (!target) {
      throw new ProcedureRigError(
        `Instrument "${step.stimulus.instrument}" cannot apply setpoints`,
      );
    }
    await target.applySetpoint(step.stimulus.set, step.stimulus.values[index]);
    return true;
  }

  private async takeReads(reads: ProcedureRead[]): Promise<SeriesRow> {
    const row: SeriesRow = {};
    for (const read of reads) {
      row[read.as] = await this.takeOneRead(read);
    }
    return row;
  }

  private async takeOneRead(read: ProcedureRead): Promise<SeriesCell | null> {
    if (!isInstrumentRead(read)) {
      return this.context.operator.readValue(read.operator, read.type);
    }

    const target = this.context.rig[read.instrument]?.read;
    if (!target) {
      throw new ProcedureRigError(`Instrument "${read.instrument}" cannot be read`);
    }

    const samples: SeriesCell[] = [];
    const repeat = read.repeat ?? 1;
    for (let index = 0; index < repeat; index++) {
      if (index > 0 && read.intervalMs) await this.sleep(read.intervalMs);
      samples.push(await this.readOnce(target, read));
    }

    // One sample stays scalar; a repeat yields the series. A cell holds a numeric
    // series; anything else is kept whole as text.
    if (repeat === 1) return samples[0];
    return samples.every((sample): sample is number => typeof sample === "number")
      ? samples
      : JSON.stringify(samples);
  }

  private async readOnce(target: ReadTarget, read: InstrumentRead): Promise<SeriesCell> {
    const command = read.command ?? this.resolveProtocol(read);

    const result = await target.execute(command, { timeoutMs: read.timeoutMs });
    if (!result.success) {
      throw result.error ?? new Error(`Read "${read.as}" failed`);
    }
    return toCell(result.data);
  }

  /** A read names a protocol; the device gets the declared object, whole. */
  private resolveProtocol(read: InstrumentRead): MeasurementProtocol {
    if (read.protocol === undefined) {
      throw new ProcedureRigError(`Read "${read.as}" names neither a command nor a protocol`);
    }
    const protocol = this.procedure.protocols?.[read.protocol];
    if (!protocol) {
      throw new ProcedureRigError(
        `Read "${read.as}" names protocol "${read.protocol}", which the procedure does not declare`,
      );
    }
    return protocol;
  }

  private missingRole(reads: ProcedureRead[]): string | undefined {
    for (const read of reads) {
      if (!isInstrumentRead(read)) continue;
      if (!this.context.rig[read.instrument]?.read) {
        return `instrument "${read.instrument}" is not connected`;
      }
    }
    return undefined;
  }

  private missingSetpointRole(role: string): string | undefined {
    return this.context.rig[role]?.setpoint ? undefined : `instrument "${role}" is not connected`;
  }

  /** An absent instrument skips an optional step and aborts a required one. */
  private skipOrFail(step: ReadStep | SweepStep, reason: string): void {
    if (!step.optional) {
      throw new ProcedureRigError(`Step "${step.series}" cannot run: ${reason}`);
    }
    this.log.warn(`Skipping optional calibration step "${step.series}": ${reason}`);
    this.skipped.push({ series: step.series, reason });
    this.report({ kind: "skipped", series: step.series, reason });
  }

  private commit(series: string, rows: SeriesRow[]): void {
    this.payload[series] = rows;
    this.report({ kind: "series", series, rows: rows.length });
  }

  private report(event: ProcedureProgress): void {
    this.context.onProgress?.(event);
  }
}

/** `{value}` and `{value.key}` in an operator prompt. */
function interpolate(prompt: string, value: SetpointValue): string {
  return prompt.replace(/\{value(?:\.([a-zA-Z0-9_]+))?\}/g, (_match, key: string | undefined) => {
    if (key === undefined) {
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    }
    return typeof value === "object" ? String(value[key] ?? "") : String(value);
  });
}

/** Narrow a driver reply to something a payload cell can hold. */
function toCell(data: unknown): SeriesCell {
  if (typeof data === "number" || typeof data === "string" || typeof data === "boolean") {
    return data;
  }
  if (Array.isArray(data) && data.every((entry) => typeof entry === "number")) {
    return data;
  }
  // A structured reply is kept whole: the script picks the field it needs.
  return JSON.stringify(data);
}

function describeStep(step: ProcedureStep): string {
  switch (step.kind) {
    case "operator":
      return step.prompt;
    case "settle":
      return `Settle ${step.ms} ms`;
    case "read":
      return `Read ${step.series}`;
    case "sweep":
      return `Sweep ${step.series}`;
  }
}

/** Return every bench instrument in a rig to a safe state. */
export async function shutdownRig(instruments: Iterable<BenchInstrument>): Promise<void> {
  for (const instrument of instruments) {
    await instrument.shutdown().catch(() => undefined);
  }
}
