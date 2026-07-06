import type { SensorFamily } from "@repo/iot";

import type { RunnerCell } from "../cells";
import { firstExecutableCellId } from "../flow/flow-utils";
import type { OutputEntry } from "../flow/hydrate";
import type { CommandProgress } from "../ports";

export const MAX_BRANCH_VISITS = 100;
export const TRACE_CAP = 500;

export type RunnerMode = "flow" | "notebook";

export type RunnerStatus =
  | "idle"
  | "awaitingInput"
  | "running"
  | "cancelling"
  | "pausedError"
  | "done"
  | "fatal";

export type EnteredVia = "forward" | "back" | "jump";

export type CellRunStatus =
  | "running"
  | "completed"
  | "error"
  | "stale"
  | "cancelled"
  | "interrupted";

export interface CellRunState {
  status: CellRunStatus;
  error?: string;
  /** Jupyter-style counters, appended per run. */
  executionOrder: number[];
  executionTimeMs?: number;
  /** Branch cells: the path the last evaluation matched. */
  lastMatchedPathId?: string;
}

export interface BranchReturnEntry {
  landingCellId: string;
  /** null means the branch was the first step; Back surfaces atStart. */
  returnToCellId: string | null;
}

export type EffectKind = "runMacro" | "runCommand" | "resolveProtocolCode";

export interface InFlightEffect {
  effectId: string;
  cellId: string;
  kind: EffectKind;
}

export interface RunnerOptionsState {
  loop: boolean;
  maxBranchVisits: number;
  allowDeviceWrites: boolean;
  deviceFamily?: SensorFamily;
}

export interface RunnerPosition {
  cellId: string | null;
  enteredVia: EnteredVia;
  /** True when Back cannot unwind further; the host owns abandon-flow. */
  atStart: boolean;
}

export interface RunnerState {
  schemaVersion: 1;
  mode: RunnerMode;
  options: RunnerOptionsState;

  /** Immutable program. Runtime values live in the maps below, never on cells. */
  cells: RunnerCell[];

  status: RunnerStatus;
  position: RunnerPosition;
  runAllActive: boolean;
  stopRequested: boolean;

  cycle: number;
  /** [cycle][questionCellId] = answer. Only the current cycle hydrates. */
  answersByCycle: Partial<Record<string, string>>[];
  /** Latest verbatim output per producer (incl. `<macroId>__dispatch`). Survives cycle wrap. */
  outputs: Partial<Record<string, OutputEntry>>;
  /** Per-pass loop-cap bookkeeping; reset on wrap / RUN_ALL / chain start. */
  branchVisits: Partial<Record<string, number>>;
  returnStack: BranchReturnEntry[];

  cellRuns: Partial<Record<string, CellRunState>>;
  execCounter: number;
  effectSeq: number;
  inFlight: InFlightEffect | null;

  /** Live streaming progress; volatile, stripped from snapshots. */
  progress: CommandProgress | null;

  fatalReason: string | null;
  trace: string[];
}

export interface CreateStateOptions {
  cells: RunnerCell[];
  mode?: RunnerMode;
  loop?: boolean;
  maxBranchVisits?: number;
  allowDeviceWrites?: boolean;
  deviceFamily?: SensorFamily;
  initialAnswers?: Record<string, string>;
}

export function createInitialState(opts: CreateStateOptions): RunnerState {
  return {
    schemaVersion: 1,
    mode: opts.mode ?? "flow",
    options: {
      loop: opts.loop ?? false,
      maxBranchVisits: opts.maxBranchVisits ?? MAX_BRANCH_VISITS,
      allowDeviceWrites: opts.allowDeviceWrites ?? false,
      deviceFamily: opts.deviceFamily,
    },
    cells: opts.cells,
    status: "idle",
    position: {
      cellId: null,
      enteredVia: "forward",
      atStart: firstExecutableCellId(opts.cells) === null,
    },
    runAllActive: false,
    stopRequested: false,
    cycle: 0,
    answersByCycle: [{ ...(opts.initialAnswers ?? {}) }],
    outputs: {},
    branchVisits: {},
    returnStack: [],
    cellRuns: {},
    execCounter: 0,
    effectSeq: 0,
    inFlight: null,
    progress: null,
    fatalReason: null,
    trace: [],
  };
}

export function currentAnswers(state: RunnerState): Partial<Record<string, string>> {
  return state.answersByCycle[state.cycle] ?? {};
}

export function trace(state: RunnerState, line: string): RunnerState {
  const next = [...state.trace, line];
  if (next.length > TRACE_CAP) next.splice(0, next.length - TRACE_CAP);
  return { ...state, trace: next };
}
