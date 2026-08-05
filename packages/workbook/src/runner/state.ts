import type { CellPath } from "@repo/api/transforms/workbook-cell-tree";
import type { SensorFamily } from "@repo/iot";

import type { RunnerCell } from "../cells";
import { firstExecutableCellId } from "../flow/flow-utils";
import type { OutputEntry } from "../flow/hydrate";
import type { CommandProgress } from "../ports";

export type { CellPath } from "@repo/api/transforms/workbook-cell-tree";

export const MAX_BRANCH_VISITS = 100;
export const TRACE_CAP = 500;
export const MAIN_TRACK_ID = "main";

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

export type EffectPhase = "runMacro" | "runCommand" | "resolveProtocolCode";

export interface InFlightEffect {
  effectId: string;
  trackId: string;
  cellId: string;
  phase: EffectPhase;
}

export interface RunnerOptionsState {
  loop: boolean;
  maxBranchVisits: number;
  allowDeviceWrites: boolean;
  /** Fallback family when the device roster is empty (single-device hosts). */
  deviceFamily?: SensorFamily;
}

/** A connected device as the runtime sees it; hosts sync the roster via SET_DEVICES. */
export interface DeviceRef {
  /** Host connection id; scopes multi-device outputs and dispatch subsets. */
  id: string;
  label: string;
  family: SensorFamily;
  /** Device-reported identity, when the handshake resolved it. */
  deviceId?: string;
  deviceName?: string;
  firmwareVersion?: string;
  batteryPercent?: number;
}

/**
 * A host-visible interaction waiting on one track. Hosts must read these
 * directly: aggregate `running` intentionally outranks `awaitingInput` while
 * a sibling effect remains in flight.
 */
export interface PendingInteraction {
  kind: "question" | "instruction" | "error" | "resume";
  cellId: string;
}

/**
 * An in-progress device-scoped dispatch: the branch grouped devices by matched
 * path and its targets run one at a time against their device subset.
 */
export interface DispatchRun {
  branchCellId: string;
  queue: { targetCellId: string; deviceIds: string[] }[];
  index: number;
}

export interface TrackCursor {
  body: CellPath;
  cellId: string | null;
  enteredVia: EnteredVia;
  /** True when Back cannot unwind further; the host owns abandon-flow. */
  atStart: boolean;
}

export type TrackStatus = "active" | "awaitingHuman" | "done" | "failed" | "partial" | "skipped";

export interface Track {
  id: string;
  laneId?: string;
  /** Frozen producer/branch device scope for this track. */
  deviceIds: string[];
  cursor: TrackCursor;
  status: TrackStatus;
  terminalReason?: string;
  branchVisits: Partial<Record<string, number>>;
  returnStack: BranchReturnEntry[];
  dispatch: DispatchRun | null;
  dispatchConsumed: Partial<Record<string, true>>;
  progress: CommandProgress | null;
  pendingInteraction: PendingInteraction | null;
}

export interface RunnerState {
  schemaVersion: 2;
  mode: RunnerMode;
  options: RunnerOptionsState;

  /** Immutable program. Runtime values live in the maps below, never on cells. */
  cells: RunnerCell[];

  /** Cached projection of deriveRunnerStatus; never written as cell state. */
  status: RunnerStatus;
  tracks: Record<string, Track>;
  runAllActive: boolean;
  stopRequested: boolean;

  cycle: number;
  /** [cycle][questionCellId] = answer. Only the current cycle hydrates. */
  answersByCycle: Partial<Record<string, string>>[];
  /** Latest verbatim output per producer (incl. `<macroId>__dispatch`). Survives cycle wrap. */
  outputs: Partial<Record<string, OutputEntry>>;

  cellRuns: Partial<Record<string, CellRunState>>;
  execCounter: number;
  effectSeq: number;
  inFlight: Partial<Record<string, InFlightEffect>>;
  /** Effect ids requested for cancellation but not yet acknowledged. */
  cancellingEffectIds: Partial<Record<string, true>>;

  /** Connected devices; each track freezes the ids it may target. */
  devices: DeviceRef[];

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
  devices?: DeviceRef[];
  initialAnswers?: Record<string, string>;
}

export function createTrack(
  id: string,
  deviceIds: string[],
  cursor: Partial<TrackCursor> = {},
  laneId?: string,
): Track {
  return {
    id,
    laneId,
    deviceIds: [...deviceIds],
    cursor: {
      body: cursor.body ?? [],
      cellId: cursor.cellId ?? null,
      enteredVia: cursor.enteredVia ?? "forward",
      atStart: cursor.atStart ?? false,
    },
    status: "active",
    branchVisits: {},
    returnStack: [],
    dispatch: null,
    dispatchConsumed: {},
    progress: null,
    pendingInteraction: null,
  };
}

export function createInitialState(opts: CreateStateOptions): RunnerState {
  const devices = opts.devices ?? [];
  const main = createTrack(
    MAIN_TRACK_ID,
    devices.map((device) => device.id),
    {
      atStart: firstExecutableCellId(opts.cells) === null,
    },
  );
  return {
    schemaVersion: 2,
    mode: opts.mode ?? "flow",
    options: {
      loop: opts.loop ?? false,
      maxBranchVisits: opts.maxBranchVisits ?? MAX_BRANCH_VISITS,
      allowDeviceWrites: opts.allowDeviceWrites ?? false,
      deviceFamily: opts.deviceFamily,
    },
    cells: opts.cells,
    status: "idle",
    tracks: { [MAIN_TRACK_ID]: main },
    runAllActive: false,
    stopRequested: false,
    cycle: 0,
    answersByCycle: [{ ...(opts.initialAnswers ?? {}) }],
    outputs: {},
    cellRuns: {},
    execCounter: 0,
    effectSeq: 0,
    inFlight: {},
    cancellingEffectIds: {},
    devices,
    fatalReason: null,
    trace: [],
  };
}

export function getTrack(state: RunnerState, trackId: string): Track {
  if (!Object.prototype.hasOwnProperty.call(state.tracks, trackId))
    throw new Error(`Unknown workbook track ${trackId}`);
  return state.tracks[trackId];
}

export function setTrack(state: RunnerState, track: Track): RunnerState {
  return { ...state, tracks: { ...state.tracks, [track.id]: track } };
}

export function updateTrack(
  state: RunnerState,
  trackId: string,
  update: (track: Track) => Track,
): RunnerState {
  return setTrack(state, update(getTrack(state, trackId)));
}

export function currentAnswers(state: RunnerState): Partial<Record<string, string>> {
  return state.answersByCycle[state.cycle] ?? {};
}

export function deriveRunnerStatus(state: RunnerState): RunnerStatus {
  if (state.fatalReason !== null) return "fatal";
  if (Object.keys(state.cancellingEffectIds).length > 0) return "cancelling";
  if (Object.keys(state.inFlight).length > 0) return "running";

  const main = state.tracks[MAIN_TRACK_ID];
  if (main.pendingInteraction?.kind === "error") return "pausedError";
  if (Object.values(state.tracks).some((track) => track.pendingInteraction !== null)) {
    return "awaitingInput";
  }
  if (state.mode === "flow" && main.status === "done") return "done";
  return "idle";
}

export function withDerivedStatus(state: RunnerState): RunnerState {
  const status = deriveRunnerStatus(state);
  return status === state.status ? state : { ...state, status };
}

export interface TrackInteraction {
  trackId: string;
  interaction: PendingInteraction;
}

/** Stable host presentation order, independent of aggregate runner status. */
export function pendingTrackInteractions(state: RunnerState): TrackInteraction[] {
  return Object.keys(state.tracks)
    .sort()
    .flatMap((trackId) => {
      const interaction = state.tracks[trackId].pendingInteraction;
      return interaction ? [{ trackId, interaction }] : [];
    });
}

export function trace(state: RunnerState, line: string): RunnerState {
  const next = [...state.trace, line];
  if (next.length > TRACE_CAP) next.splice(0, next.length - TRACE_CAP);
  return { ...state, trace: next };
}
