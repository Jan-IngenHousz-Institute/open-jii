import type { SensorFamily } from "@repo/iot";

import type { RunnerCell } from "../cells";
import { DISPATCH_STEP_SUFFIX } from "../flow/flow-utils";
import type { ClockPort } from "../ports/clock";
import { systemClock } from "../ports/clock";
import type { CommandExecutorPort } from "../ports/command-executor";
import type { LoggerPort } from "../ports/logger";
import { noopLogger } from "../ports/logger";
import type { MacroRunnerPort } from "../ports/macro-runner";
import type { OutputStorePort } from "../ports/output-store";
import type { ProtocolCodeResolverPort } from "../ports/protocol-code-resolver";
import type { Effect } from "./effects";
import type { WorkbookEvent, WorkbookPublicEvent } from "./events";
import { transition } from "./reducer";
import type { WorkbookSnapshot } from "./snapshot";
import { hashCells, parseSnapshot, SnapshotError, toSnapshot } from "./snapshot";
import type { RunnerMode, RunnerState } from "./state";
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
  deviceFamily?: SensorFamily;
  initialAnswers?: Record<string, string>;
}

const DEFAULT_OFFLOAD_BYTES = 256 * 1024;

function validateCells(cells: RunnerCell[]): void {
  const seen = new Set<string>();
  for (const cell of cells) {
    if (cell.id.endsWith(DISPATCH_STEP_SUFFIX)) {
      throw new Error(`Cell id "${cell.id}" uses the reserved "${DISPATCH_STEP_SUFFIX}" suffix`);
    }
    if (seen.has(cell.id)) {
      throw new Error(`Duplicate cell id "${cell.id}"`);
    }
    seen.add(cell.id);
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
        deviceFamily: options.deviceFamily,
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
        outputs[key] = { v: await ports.outputStore.get(entry.ref) };
      } else {
        outputs[key] = { v: entry.v };
      }
    }
    const state = { ...parsed.state, outputs } as unknown as RunnerState;
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
      const size = entry.v === undefined ? 0 : JSON.stringify(entry.v).length;
      if (size <= offloadOverBytes) continue;
      const ref = await store.put(`${key}:${snapshot.savedAt}`, entry.v);
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
          const cellId =
            this.state.inFlight?.effectId === effectId ? this.state.inFlight.cellId : null;
          if (cellId !== null) {
            this.dispatch({ type: "EFFECT_CANCELLED", effectId, cellId });
          }
        }
        return;
      }
      case "runMacro":
        this.runAsync(effect.effectId, effect.cellId, "macro", (signal) =>
          this.ports.macroRunner.run(effect.input, { signal }),
        );
        return;
      case "runCommand":
        this.runAsync(effect.effectId, effect.cellId, "command", (signal) =>
          this.ports.commandExecutor.execute(effect.input, {
            signal,
            onProgress: (progress) =>
              this.dispatch({
                type: "COMMAND_PROGRESS",
                effectId: effect.effectId,
                cellId: effect.cellId,
                progress,
              }),
          }),
        );
        return;
      case "resolveProtocolCode": {
        const resolver = this.ports.protocolCodeResolver;
        if (!resolver) {
          this.dispatch({
            type: "CODE_RESOLVE_FAILED",
            effectId: effect.effectId,
            cellId: effect.cellId,
            error: "No protocol code resolver configured",
            timings: { startedAt: this.clock.now(), endedAt: this.clock.now() },
          });
          return;
        }
        this.runAsync(effect.effectId, effect.cellId, "code", () =>
          resolver.resolveProtocolCode(effect.protocolId, effect.version),
        );
        return;
      }
    }
  }

  private runAsync(
    effectId: string,
    cellId: string,
    family: "macro" | "command" | "code",
    run: (signal: AbortSignal) => Promise<unknown>,
  ): void {
    const controller = new AbortController();
    this.controllers.set(effectId, controller);
    const startedAt = this.clock.now();

    void run(controller.signal)
      .then((output) => {
        const timings = { startedAt, endedAt: this.clock.now() };
        if (controller.signal.aborted) {
          this.dispatch({ type: "EFFECT_CANCELLED", effectId, cellId });
          return;
        }
        if (family === "macro") {
          this.dispatch({
            type: "MACRO_DONE",
            effectId,
            cellId,
            output: (output ?? {}) as Record<string, unknown>,
            timings,
          });
        } else if (family === "code") {
          this.dispatch({
            type: "CODE_RESOLVED",
            effectId,
            cellId,
            code: output as Record<string, unknown>[] | null,
            timings,
          });
        } else {
          this.dispatch({ type: "COMMAND_DONE", effectId, cellId, output, timings });
        }
      })
      .catch((error: unknown) => {
        const timings = { startedAt, endedAt: this.clock.now() };
        if (controller.signal.aborted) {
          this.dispatch({ type: "EFFECT_CANCELLED", effectId, cellId });
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (family === "macro") {
          this.dispatch({ type: "MACRO_FAILED", effectId, cellId, error: message, timings });
        } else if (family === "code") {
          this.dispatch({ type: "CODE_RESOLVE_FAILED", effectId, cellId, error: message, timings });
        } else {
          this.dispatch({ type: "COMMAND_FAILED", effectId, cellId, error: message, timings });
        }
      })
      .finally(() => {
        this.controllers.delete(effectId);
      });
  }
}
