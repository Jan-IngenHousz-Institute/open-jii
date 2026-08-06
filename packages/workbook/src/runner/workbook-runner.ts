import type { OutputDeviceResult } from "@repo/api/domains/workbook/workbook-cells.schema";
import { resolveParallelDefaultLane } from "@repo/api/domains/workbook/workbook-cells.schema";
import { sanitizeQuestionLabel } from "@repo/api/transforms/label-sanitization";
import { walkWorkbookCells } from "@repo/api/transforms/workbook-cell-tree";
import type { SensorFamily } from "@repo/iot";

import type { RunnerCell } from "../cells";
import { DISPATCH_STEP_SUFFIX } from "../flow/flow-utils";
import type { ClockPort } from "../ports";
import { systemClock } from "../ports";
import type { CommandExecutorPort, DeviceOutcome } from "../ports";
import type { LoggerPort } from "../ports";
import { noopLogger } from "../ports";
import type { MacroRunnerPort } from "../ports";
import type { OutputStorePort } from "../ports";
import type { ProtocolCodeResolverPort } from "../ports";
import type { Effect } from "./effects";
import type { WorkbookEvent, WorkbookPublicEvent } from "./events";
import { collapseOutcomes } from "./fan-out";
import { transition } from "./reducer";
import type { WorkbookSnapshot } from "./snapshot";
import { hashCells, parseSnapshot, SnapshotError, toSnapshot } from "./snapshot";
import type { DeviceRef, RunnerMode, RunnerState } from "./state";
import { createInitialState } from "./state";

export interface WorkbookRunnerPorts {
  macroRunner: MacroRunnerPort;
  commandExecutor: CommandExecutorPort;
  protocolCodeResolver?: ProtocolCodeResolverPort;
  outputStore?: OutputStorePort;
  logger?: LoggerPort;
  clock?: ClockPort;
}

export interface WorkbookRunnerOptions {
  cells: RunnerCell[];
  ports: WorkbookRunnerPorts;
  mode?: RunnerMode;
  loop?: boolean;
  maxBranchVisits?: number;
  allowDeviceWrites?: boolean;
  allowMacroArtifactDispatch?: boolean;
  /** Mobile compatibility: inline command results wait for explicit Continue. */
  pauseAfterInlineCommand?: boolean;
  deviceFamily?: SensorFamily;
  devices?: DeviceRef[];
  initialAnswers?: Record<string, string>;
}

const DEFAULT_OFFLOAD_BYTES = 256 * 1024;
const OFFLOADED_ENTRY_MARKER = "__workbookOutputEntryV2";

function validateCells(cells: RunnerCell[]): void {
  const seen = new Set<string>();
  const parallelNames = new Set<string>();
  for (const { cell } of walkWorkbookCells(cells)) {
    if (cell.id.endsWith(DISPATCH_STEP_SUFFIX)) {
      throw new Error(`Cell id "${cell.id}" uses the reserved "${DISPATCH_STEP_SUFFIX}" suffix`);
    }
    if (seen.has(cell.id)) {
      throw new Error(`Duplicate cell id "${cell.id}"`);
    }
    seen.add(cell.id);
    if (cell.type !== "parallel") continue;
    const canonical = sanitizeQuestionLabel(cell.name);
    if (parallelNames.has(canonical)) {
      throw new Error(`Duplicate parallel container name "${cell.name}"`);
    }
    parallelNames.add(canonical);
    const laneIds = new Set<string>();
    for (const lane of cell.lanes) {
      if (laneIds.has(lane.id)) {
        throw new Error(`Duplicate lane id "${lane.id}" in container "${cell.id}"`);
      }
      laneIds.add(lane.id);
    }
    if (resolveParallelDefaultLane(cell).kind !== "resolved") {
      throw new Error(`Parallel container "${cell.id}" must have exactly one default lane`);
    }
  }
}

/**
 * Environment-agnostic workbook execution driver. Owns the state produced by
 * the pure `transition` reducer, executes its effects through the injected
 * ports, and feeds completions back as internal events. Hosts subscribe for
 * state and send public events; nothing here touches a device or a sandbox
 * directly.
 */
export class WorkbookRunner {
  private state: RunnerState;
  private readonly ports: WorkbookRunnerPorts;
  private readonly clock: ClockPort;
  private readonly logger: LoggerPort;
  private readonly listeners = new Set<(state: Readonly<RunnerState>) => void>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly queue: WorkbookEvent[] = [];
  private draining = false;
  private disposed = false;

  constructor(options: WorkbookRunnerOptions, restoredState?: RunnerState) {
    validateCells(options.cells);
    this.ports = options.ports;
    this.clock = options.ports.clock ?? systemClock;
    this.logger = options.ports.logger ?? noopLogger;
    this.state =
      restoredState ??
      createInitialState({
        cells: options.cells,
        mode: options.mode,
        loop: options.loop,
        maxBranchVisits: options.maxBranchVisits,
        allowDeviceWrites: options.allowDeviceWrites,
        allowMacroArtifactDispatch: options.allowMacroArtifactDispatch,
        pauseAfterInlineCommand: options.pauseAfterInlineCommand,
        deviceFamily: options.deviceFamily,
        devices: options.devices,
        initialAnswers: options.initialAnswers,
      });
  }

  /** Rebuild from a persisted snapshot; ports are re-injected, never serialized. */
  static async restore(snapshot: unknown, ports: WorkbookRunnerPorts): Promise<WorkbookRunner> {
    const parsed = parseSnapshot(snapshot);
    if (hashCells(parsed.state.cells) !== parsed.cellsHash) {
      throw new SnapshotError("cellsMismatch", "Snapshot cells do not match their hash");
    }
    const outputs: RunnerState["outputs"] = {};
    for (const [key, entry] of Object.entries(parsed.state.outputs)) {
      if ("ref" in entry) {
        if (!ports.outputStore) {
          throw new SnapshotError(
            "missingStore",
            "Snapshot has offloaded outputs but no outputStore port",
          );
        }
        const stored = await ports.outputStore.get(entry.ref);
        if (
          stored !== null &&
          typeof stored === "object" &&
          (stored as Record<string, unknown>)[OFFLOADED_ENTRY_MARKER] === true
        ) {
          outputs[key] = (stored as { entry: RunnerState["outputs"][string] }).entry;
        } else {
          outputs[key] = {
            v: stored,
            ...(entry.deviceResults ? { deviceResults: entry.deviceResults } : {}),
            ...(entry.messages ? { messages: entry.messages } : {}),
          };
        }
      } else {
        outputs[key] = {
          v: entry.v,
          ...(entry.deviceResults ? { deviceResults: entry.deviceResults } : {}),
          ...(entry.messages ? { messages: entry.messages } : {}),
        };
      }
    }
    const state = { ...parsed.state, outputs };
    return new WorkbookRunner({ cells: state.cells, ports }, state);
  }

  start(): void {
    this.send({ type: "START" });
  }

  send(event: WorkbookPublicEvent): void {
    this.dispatch(event);
  }

  cancel(): void {
    this.send({ type: "CANCEL" });
  }

  /** Sync the connected-device roster (fan-out targets, dispatch grouping, $device). */
  setDevices(devices: DeviceRef[]): void {
    this.send({ type: "SET_DEVICES", devices });
  }

  getState(): Readonly<RunnerState> {
    return this.state;
  }

  subscribe(listener: (state: Readonly<RunnerState>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** JSON-safe, versioned; in-flight work re-arms as `interrupted`. */
  snapshot(): WorkbookSnapshot {
    return toSnapshot(this.state, this.clock.now());
  }

  /** Snapshot with large outputs offloaded to the OutputStorePort as refs. */
  async snapshotOffloaded(
    offloadOverBytes: number = DEFAULT_OFFLOAD_BYTES,
  ): Promise<WorkbookSnapshot> {
    const store = this.ports.outputStore;
    if (!store)
      throw new SnapshotError("missingStore", "snapshotOffloaded requires an outputStore port");
    const snapshot = this.snapshot();
    for (const [key, entry] of Object.entries(snapshot.state.outputs)) {
      if ("ref" in entry) continue;
      const size = JSON.stringify(entry).length;
      if (size <= offloadOverBytes) continue;
      const ref = await store.put(`${key}:${snapshot.savedAt}`, {
        [OFFLOADED_ENTRY_MARKER]: true,
        entry,
      });
      snapshot.state.outputs[key] = { ref };
    }
    return snapshot;
  }

  dispose(): void {
    this.disposed = true;
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    this.listeners.clear();
  }

  private dispatch(event: WorkbookEvent): void {
    if (this.disposed) return;
    this.queue.push(event);
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next === undefined) break;
        const result = transition(this.state, next);
        this.state = result.state;
        // Effects launch before notify: a subscriber that reacts synchronously
        // (e.g. CANCEL on seeing "running") must find the AbortController.
        for (const effect of result.effects) this.execute(effect);
        this.notify();
      }
    } finally {
      this.draining = false;
    }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(this.state);
      } catch (error) {
        this.logger.error("workbook subscriber threw", {
          err: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private execute(effect: Effect): void {
    switch (effect.kind) {
      case "cancelEffects": {
        for (const effectId of effect.effectIds) {
          this.controllers.get(effectId)?.abort();
          this.controllers.delete(effectId);
          // Snappy finalize; a late settle is dropped by the effectId gate.
          const owned = this.state.inFlight[effectId];
          if (owned) {
            this.dispatch({
              type: "EFFECT_CANCELLED",
              effectId,
              trackId: owned.trackId,
              cellId: owned.cellId,
            });
          }
        }
        return;
      }
      case "runMacro":
        this.runMacroEffect(effect);
        return;
      case "runCommand":
        this.runCommandEffect(effect);
        return;
      case "resolveProtocolCode": {
        const resolver = this.ports.protocolCodeResolver;
        if (!resolver) {
          this.dispatch({
            type: "CODE_RESOLVE_FAILED",
            effectId: effect.effectId,
            trackId: effect.trackId,
            cellId: effect.cellId,
            error: "No protocol code resolver configured",
            timings: { startedAt: this.clock.now(), endedAt: this.clock.now() },
          });
          return;
        }
        this.runAsync(effect.effectId, effect.trackId, effect.cellId, () =>
          resolver.resolveProtocolCode(effect.protocolId, effect.version),
        );
        return;
      }
    }
  }

  /** Register an AbortController and return a settle guard for one effect. */
  private armEffect(effectId: string, trackId: string, cellId: string) {
    const controller = new AbortController();
    this.controllers.set(effectId, controller);
    const startedAt = this.clock.now();
    const settle = (dispatchDone: (timings: { startedAt: number; endedAt: number }) => void) => {
      const timings = { startedAt, endedAt: this.clock.now() };
      if (controller.signal.aborted) {
        this.dispatch({ type: "EFFECT_CANCELLED", effectId, trackId, cellId });
        return;
      }
      dispatchDone(timings);
    };
    return { controller, settle };
  }

  /**
   * Execute a macro effect. Multi-device legs run serially (one sandbox
   * invocation at a time, web parity), carried upstream failures interleave in
   * device order, and the outcomes collapse into one completion event. A plain
   * single-device run keeps the exact legacy MACRO_DONE/MACRO_FAILED shape.
   */
  private runMacroEffect(effect: Extract<Effect, { kind: "runMacro" }>): void {
    const { effectId, trackId, cellId } = effect;
    const { controller, settle } = this.armEffect(effectId, trackId, cellId);
    const firstLeg = effect.legs[0];
    const singleLeg =
      effect.legs.length === 1 && firstLeg.kind === "run" && firstLeg.input.deviceId === undefined
        ? firstLeg
        : null;

    const finish = (result: {
      output?: Record<string, unknown>;
      error?: string;
      deviceResults?: OutputDeviceResult[];
      messages?: string[];
    }) => {
      settle((timings) => {
        if (result.error !== undefined) {
          this.dispatch({
            type: "MACRO_FAILED",
            effectId,
            trackId,
            cellId,
            ...result,
            error: result.error,
            timings,
          });
        } else {
          this.dispatch({
            type: "MACRO_DONE",
            effectId,
            trackId,
            cellId,
            ...result,
            output: result.output ?? {},
            timings,
          });
        }
      });
    };

    void (async () => {
      if (singleLeg) {
        try {
          const output = await this.ports.macroRunner.run(singleLeg.input, {
            signal: controller.signal,
            effectId,
          });
          return { output };
        } catch (error) {
          return { error: errorMessage(error) };
        }
      }

      const outcomes: DeviceOutcome[] = [];
      for (const leg of effect.legs) {
        if (leg.kind === "carriedFailure") {
          outcomes.push(leg.outcome);
          continue;
        }
        if (controller.signal.aborted) break;
        const identity = {
          deviceId: leg.input.deviceId ?? "",
          deviceLabel: leg.input.deviceLabel ?? leg.input.deviceId ?? "",
          family: leg.input.family,
          deviceName: leg.input.deviceName,
        };
        try {
          const output = await this.ports.macroRunner.run(leg.input, {
            signal: controller.signal,
            effectId,
          });
          outcomes.push({ ...identity, data: output });
        } catch (error) {
          outcomes.push({ ...identity, error: errorMessage(error) });
        }
      }
      const collapsed = collapseOutcomes(outcomes, "Macro execution failed");
      return collapsed.ok
        ? {
            output: (collapsed.v ?? {}) as Record<string, unknown>,
            deviceResults: collapsed.deviceResults,
            messages: collapsed.messages,
          }
        : {
            error: collapsed.error,
            deviceResults: collapsed.deviceResults,
            messages: collapsed.messages,
          };
    })()
      .then(finish)
      .catch((error: unknown) => finish({ error: errorMessage(error) }))
      .finally(() => this.controllers.delete(effectId));
  }

  /** Execute a command effect; the port returns one outcome per targeted device. */
  private runCommandEffect(effect: Extract<Effect, { kind: "runCommand" }>): void {
    const { effectId, trackId, cellId } = effect;
    const { controller, settle } = this.armEffect(effectId, trackId, cellId);

    void this.ports.commandExecutor
      .execute(effect.input, {
        signal: controller.signal,
        effectId,
        onProgress: (progress) =>
          this.dispatch({ type: "COMMAND_PROGRESS", effectId, trackId, cellId, progress }),
      })
      .then((outcomes) => {
        const collapsed = collapseOutcomes(outcomes, "Command execution failed");
        settle((timings) => {
          if (collapsed.ok) {
            this.dispatch({
              type: "COMMAND_DONE",
              effectId,
              trackId,
              cellId,
              output: collapsed.v,
              deviceResults: collapsed.deviceResults,
              messages: collapsed.messages,
              timings,
            });
          } else {
            this.dispatch({
              type: "COMMAND_FAILED",
              effectId,
              trackId,
              cellId,
              error: collapsed.error,
              deviceResults: collapsed.deviceResults,
              messages: collapsed.messages,
              timings,
            });
          }
        });
      })
      .catch((error: unknown) =>
        settle((timings) =>
          this.dispatch({
            type: "COMMAND_FAILED",
            effectId,
            trackId,
            cellId,
            error: errorMessage(error),
            timings,
          }),
        ),
      )
      .finally(() => this.controllers.delete(effectId));
  }

  private runAsync(
    effectId: string,
    trackId: string,
    cellId: string,
    run: (signal: AbortSignal) => Promise<unknown>,
  ): void {
    const { controller, settle } = this.armEffect(effectId, trackId, cellId);
    void run(controller.signal)
      .then((output) =>
        settle((timings) =>
          this.dispatch({
            type: "CODE_RESOLVED",
            effectId,
            trackId,
            cellId,
            code: output as Record<string, unknown>[] | null,
            timings,
          }),
        ),
      )
      .catch((error: unknown) =>
        settle((timings) =>
          this.dispatch({
            type: "CODE_RESOLVE_FAILED",
            effectId,
            trackId,
            cellId,
            error: errorMessage(error),
            timings,
          }),
        ),
      )
      .finally(() => this.controllers.delete(effectId));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
