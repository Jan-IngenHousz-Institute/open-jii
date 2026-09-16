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
  SetStep,
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

/**
 * Where a reading the operator took again is kept, beside the series it was taken for.
 * The contract layer owns this convention and validates payloads against it; this package
 * cannot import it, so the two must agree by spelling.
 */
export const DISCARDED_SERIES_SUFFIX = "_retaken";

export async function runCaptureProcedure(
  procedure: CaptureProcedure,
  context: ProcedureContext,
): Promise<CaptureResult> {
  const runner = new ProcedureRunner(procedure, procedure.steps, context);
  return runner.run();
}

/** The steps declared to run once the coefficients are on the device; none declared captures nothing. */
export async function runVerificationProcedure(
  procedure: CaptureProcedure,
  context: ProcedureContext,
): Promise<CaptureResult> {
  const runner = new ProcedureRunner(procedure, procedure.verify ?? [], context);
  return runner.run();
}

class ProcedureRunner {
  private readonly payload: CaptureResult["payload"] = {};
  private readonly skipped: CaptureResult["skipped"] = [];
  private readonly log: Logger;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly procedure: CaptureProcedure,
    private readonly steps: ProcedureStep[],
    private readonly context: ProcedureContext,
  ) {
    this.log = context.logger ?? defaultLogger;
    this.sleep = context.sleep ?? realSleep;
  }

  async run(): Promise<CaptureResult> {
    this.assertRigDeclaresDut();

    const steps = this.steps;
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
      case "set":
        await this.runSetStep(step);
        return;
      case "read":
        await this.runReadStep(step);
        return;
      case "sweep":
        await this.runSweepStep(step);
        return;
    }
  }

  /** A set step produces no series, so an absent instrument always aborts. */
  private async runSetStep(step: SetStep): Promise<void> {
    const unavailable = this.missingSetpointRole(step.instrument);
    if (unavailable) {
      throw new ProcedureRigError(`Cannot set ${step.instrument} ${step.set}: ${unavailable}`);
    }
    await this.applySetpoint(step.instrument, step.set, step.value);
  }

  private async runReadStep(step: ReadStep): Promise<void> {
    const unavailable = this.missingRole(step.read);
    if (unavailable) return this.skipOrFail(step, unavailable);

    for (let attempt = 1; ; attempt++) {
      if (step.prompt) {
        const accepted = await this.context.operator.acknowledge(step.prompt);
        if (!accepted) return this.skipOrFail(step, `operator declined: ${step.prompt}`);
      }

      const row = await this.takeReads(step.read);

      // Only a step the operator was asked to set up can be set up again.
      const isKept =
        step.prompt === undefined ||
        (await this.context.operator.confirmReading({
          series: step.series,
          stimulus: undefined,
          row,
        }));

      if (isKept) {
        this.commit(step.series, [row]);
        return;
      }

      this.discard(step.series, row);
      this.report({ kind: "retake", series: step.series, index: 0, attempt });
    }
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
    // Nobody is standing over a sweep the rig drives, so only an operator-driven one can
    // be taken again.
    const isOperatorDriven = !isInstrumentStimulus(step.stimulus);

    for (const [index, value] of values.entries()) {
      this.report({
        kind: "setpoint",
        series: step.series,
        index,
        total: values.length,
        value,
      });

      for (let attempt = 1; ; attempt++) {
        const applied = await this.applyStimulus(step, index);
        if (!applied) {
          return this.skipOrFail(step, `operator declined a setpoint in ${step.series}`);
        }

        if (step.settleMs) await this.sleep(step.settleMs);

        const row = await this.takeReads(step.read, value);
        row[SWEEP_STIMULUS_COLUMN] = value;

        const isKept =
          !isOperatorDriven ||
          (await this.context.operator.confirmReading({
            series: step.series,
            stimulus: value,
            row,
          }));

        if (isKept) {
          rows.push(row);
          break;
        }

        this.discard(step.series, row);
        this.report({ kind: "retake", series: step.series, index, attempt });
      }
    }

    this.commit(step.series, rows);
  }

  /** Read off the narrowed stimulus so an instrument value is a number by type. */
  private async applyStimulus(step: SweepStep, index: number): Promise<boolean> {
    if (!isInstrumentStimulus(step.stimulus)) {
      const value = step.stimulus.values[index];
      return this.context.operator.acknowledge(interpolate(step.stimulus.operator, value));
    }

    await this.applySetpoint(
      step.stimulus.instrument,
      step.stimulus.set,
      step.stimulus.values[index],
    );
    return true;
  }

  private async applySetpoint(role: string, name: string, value: number): Promise<void> {
    const target = this.context.rig[role]?.setpoint;
    if (!target) {
      throw new ProcedureRigError(`Instrument "${role}" cannot apply setpoints`);
    }
    await target.applySetpoint(name, value);
  }

  /** `value` is the sweep setpoint the reads are taken at; a read step has none. */
  private async takeReads(reads: ProcedureRead[], value?: SetpointValue): Promise<SeriesRow> {
    const row: SeriesRow = {};
    for (const read of reads) {
      row[read.as] = await this.takeOneRead(read, value);
    }
    return row;
  }

  private async takeOneRead(
    read: ProcedureRead,
    value?: SetpointValue,
  ): Promise<SeriesCell | null> {
    if (!isInstrumentRead(read)) {
      return this.context.operator.readValue(interpolate(read.operator, value), read.type);
    }

    const target = this.context.rig[read.instrument]?.read;
    if (!target) {
      throw new ProcedureRigError(`Instrument "${read.instrument}" cannot be read`);
    }

    const samples: SeriesCell[] = [];
    const repeat = read.repeat ?? 1;
    for (let index = 0; index < repeat; index++) {
      if (index > 0 && read.intervalMs) await this.sleep(read.intervalMs);
      samples.push(await this.readOnce(target, read, value));
    }

    // One sample stays scalar; a repeat yields the series. A cell holds a numeric
    // series; anything else is kept whole as text.
    if (repeat === 1) return samples[0];
    return samples.every((sample): sample is number => typeof sample === "number")
      ? samples
      : JSON.stringify(samples);
  }

  private async readOnce(
    target: ReadTarget,
    read: InstrumentRead,
    value?: SetpointValue,
  ): Promise<SeriesCell> {
    const command =
      read.command === undefined
        ? this.resolveProtocol(read, value)
        : interpolate(read.command, value);

    const result = await target.execute(command, { timeoutMs: read.timeoutMs });
    if (!result.success) {
      throw result.error ?? new Error(`Read "${read.as}" failed`);
    }
    return toCell(result.data);
  }

  /** A read names a protocol; the device gets the declared object, whole, or a clone per setpoint. */
  private resolveProtocol(read: InstrumentRead, value?: SetpointValue): MeasurementProtocol {
    if (read.protocol === undefined) {
      throw new ProcedureRigError(`Read "${read.as}" names neither a command nor a protocol`);
    }
    const protocol = this.procedure.protocols?.[read.protocol];
    if (!protocol) {
      throw new ProcedureRigError(
        `Read "${read.as}" names protocol "${read.protocol}", which the procedure does not declare`,
      );
    }

    if (value === undefined || !holdsPlaceholder(JSON.stringify(protocol))) {
      return protocol;
    }

    return interpolateProtocol(protocol, value);
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

  /**
   * A reading the operator took again is kept beside the series rather than dropped. The
   * fit never sees it, and a reviewer can still see that a point was taken twice and what
   * the first attempt said.
   */
  private discard(series: string, row: SeriesRow): void {
    const name = `${series}${DISCARDED_SERIES_SUFFIX}`;
    this.payload[name] = [...(this.payload[name] ?? []), row];
  }

  private report(event: ProcedureProgress): void {
    this.context.onProgress?.(event);
  }
}

/** The sweep setpoint, as it may be written into a prompt, a read command, or a protocol's strings. */
const SETPOINT_PLACEHOLDER = /\{value(?:\.([a-zA-Z0-9_]+))?\}/g;
const LONE_SETPOINT_PLACEHOLDER = new RegExp(`^${SETPOINT_PLACEHOLDER.source}$`);

/** Outside a sweep there is no setpoint, and the declared text stands as written. */
function interpolate(text: string, value: SetpointValue | undefined): string {
  if (value === undefined) {
    return text;
  }

  return text.replace(SETPOINT_PLACEHOLDER, (_match, key: string | undefined) => {
    if (key === undefined) {
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    }
    return typeof value === "object" ? String(value[key] ?? "") : String(value);
  });
}

// search, not test: the shared pattern is global, and test would leave its lastIndex behind.
function holdsPlaceholder(text: string): boolean {
  return text.search(SETPOINT_PLACEHOLDER) !== -1;
}

/** Resolved into a clone per setpoint: the declared protocols are the definition and are never written to. */
function interpolateProtocol(
  protocol: MeasurementProtocol,
  value: SetpointValue,
): MeasurementProtocol {
  const resolved: MeasurementProtocol = {};

  for (const [key, node] of Object.entries(protocol)) {
    resolved[key] = interpolateNode(node, value);
  }

  return resolved;
}

function interpolateNode(node: unknown, value: SetpointValue): unknown {
  if (typeof node === "string") {
    const text = interpolate(node, value);
    // A leaf that is nothing but the placeholder takes the setpoint's own type, so a
    // device gets `"pulses": [20]` rather than `["20"]`.
    const isLoneNumber = LONE_SETPOINT_PLACEHOLDER.test(node) && NUMERIC_TEXT.test(text);
    return isLoneNumber ? Number(text) : text;
  }

  if (isProtocolArray(node)) {
    return node.map((entry) => interpolateNode(entry, value));
  }

  if (isProtocolObject(node)) {
    return interpolateProtocol(node, value);
  }

  return node;
}

function isProtocolArray(node: unknown): node is unknown[] {
  return Array.isArray(node);
}

function isProtocolObject(node: unknown): node is MeasurementProtocol {
  return typeof node === "object" && node !== null && !Array.isArray(node);
}

const NUMERIC_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/** Narrow a driver reply to something a payload cell can hold. */
function toCell(data: unknown): SeriesCell {
  // A console prints readings as text; a reading is a number to the script and the fit.
  if (typeof data === "string" && NUMERIC_TEXT.test(data.trim())) {
    return Number(data.trim());
  }
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
    case "set":
      return `Set ${step.instrument} ${step.set} to ${step.value}`;
    case "read":
      return `Read ${step.series}`;
    case "sweep":
      return `Sweep ${step.series}`;
  }
}

/** A supply applies setpoints, a reference reports readings; a read's `command` is the reading's name. */
export function bindBenchInstrument(instrument: BenchInstrument): RigBinding {
  const binding: RigBinding = {};

  if (instrument.setpoints.length > 0) {
    binding.setpoint = instrument;
  }

  const read = instrument.read?.bind(instrument);
  if (read) {
    binding.read = {
      execute: async (command) => {
        if (typeof command !== "string") {
          return {
            success: false,
            error: new Error(`${instrument.model} takes a reading name, not a protocol`),
          };
        }
        try {
          return { success: true, data: await read(command) };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    };
  }

  return binding;
}

/** Return every bench instrument in a rig to a safe state. */
export async function shutdownRig(instruments: Iterable<BenchInstrument>): Promise<void> {
  for (const instrument of instruments) {
    await instrument.shutdown().catch(() => undefined);
  }
}
