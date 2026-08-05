import { z } from "zod";

import { SENSOR_FAMILIES } from "@repo/iot";

import { ownerCellId } from "./cell-entry";
import type { PendingInteraction, RunnerState, Track } from "./state";
import { MAIN_TRACK_ID, withDerivedStatus } from "./state";

export type SnapshotErrorCode = "invalid" | "unsupportedVersion" | "cellsMismatch" | "missingStore";

export class SnapshotError extends Error {
  readonly code: SnapshotErrorCode;
  constructor(code: SnapshotErrorCode, message: string) {
    super(message);
    this.name = "SnapshotError";
    this.code = code;
  }
}

const zDeviceResult = z.object({ deviceId: z.string() }).passthrough();

// Ref variant first: `v: z.unknown()` also matches a bare `{ ref }` object.
const zOutputEntry = z.union([
  z
    .object({
      ref: z.string(),
      deviceResults: z.array(zDeviceResult).optional(),
      messages: z.array(z.string()).optional(),
    })
    .strict(),
  z.object({
    v: z.unknown(),
    deviceResults: z.array(zDeviceResult).optional(),
    messages: z.array(z.string()).optional(),
  }),
]);

export type SnapshotOutputEntry = z.infer<typeof zOutputEntry>;

const zCellRun = z.object({
  status: z.enum(["running", "completed", "error", "stale", "cancelled", "interrupted"]),
  error: z.string().optional(),
  executionOrder: z.array(z.number()),
  executionTimeMs: z.number().optional(),
  lastMatchedPathId: z.string().optional(),
});

// Cells are validated structurally, not against zWorkbookCellArray: snapshots
// must survive cell kinds this build predates (command cells, future types).
const zLooseCell = z.object({ id: z.string().min(1), type: z.string().min(1) }).passthrough();

const zOptions = z.object({
  loop: z.boolean(),
  maxBranchVisits: z.number(),
  allowDeviceWrites: z.boolean(),
  deviceFamily: z.enum(SENSOR_FAMILIES).optional(),
});

const zDevice = z.object({
  id: z.string(),
  label: z.string(),
  family: z.enum(SENSOR_FAMILIES),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  firmwareVersion: z.string().optional(),
  batteryPercent: z.number().optional(),
});

const zStatus = z.enum([
  "idle",
  "awaitingInput",
  "running",
  "cancelling",
  "pausedError",
  "done",
  "fatal",
]);

const zEnteredVia = z.enum(["forward", "back", "jump"]);
const zReturnStack = z.array(
  z.object({ landingCellId: z.string(), returnToCellId: z.string().nullable() }),
);

const zSnapshotStateV1 = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(["flow", "notebook"]),
  options: zOptions,
  cells: z.array(zLooseCell),
  status: zStatus,
  position: z.object({
    cellId: z.string().nullable(),
    enteredVia: zEnteredVia,
    atStart: z.boolean(),
  }),
  runAllActive: z.boolean(),
  stopRequested: z.boolean(),
  cycle: z.number().int().nonnegative(),
  answersByCycle: z.array(z.record(z.string())),
  outputs: z.record(zOutputEntry),
  branchVisits: z.record(z.number()),
  returnStack: zReturnStack,
  cellRuns: z.record(zCellRun),
  execCounter: z.number().int().nonnegative(),
  effectSeq: z.number().int().nonnegative(),
  inFlight: z.null(),
  devices: z.array(zDevice).default([]),
  dispatch: z.null().default(null),
  dispatchConsumed: z.record(z.literal(true)).default({}),
  progress: z.null(),
  fatalReason: z.string().nullable(),
  trace: z.array(z.string()),
});

const zWorkbookSnapshotV1 = z.object({
  schemaVersion: z.literal(1),
  savedAt: z.number(),
  cellsHash: z.string(),
  state: zSnapshotStateV1,
});

const zCellPath = z.array(z.object({ containerCellId: z.string(), laneId: z.string() }));
const zPendingInteraction = z
  .object({
    kind: z.enum(["question", "instruction", "error", "resume"]),
    cellId: z.string(),
  })
  .nullable();
const zDispatch = z
  .object({
    branchCellId: z.string(),
    queue: z.array(z.object({ targetCellId: z.string(), deviceIds: z.array(z.string()) })),
    index: z.number().int().nonnegative(),
  })
  .nullable();
const zTrack = z.object({
  id: z.string(),
  laneId: z.string().optional(),
  deviceIds: z.array(z.string()),
  cursor: z.object({
    body: zCellPath,
    cellId: z.string().nullable(),
    enteredVia: zEnteredVia,
    atStart: z.boolean(),
  }),
  status: z.enum(["active", "awaitingHuman", "done", "failed", "partial", "skipped"]),
  terminalReason: z.string().optional(),
  branchVisits: z.record(z.number()),
  returnStack: zReturnStack,
  dispatch: zDispatch,
  dispatchConsumed: z.record(z.literal(true)),
  progress: z.null(),
  pendingInteraction: zPendingInteraction,
});
const zInFlight = z.object({
  effectId: z.string(),
  trackId: z.string(),
  cellId: z.string(),
  phase: z.enum(["runMacro", "runCommand", "resolveProtocolCode"]),
});

const zSnapshotStateV2 = z.object({
  schemaVersion: z.literal(2),
  mode: z.enum(["flow", "notebook"]),
  options: zOptions,
  cells: z.array(zLooseCell),
  status: zStatus,
  tracks: z
    .record(zTrack)
    .refine(
      (tracks) =>
        Object.prototype.hasOwnProperty.call(tracks, MAIN_TRACK_ID) &&
        Object.entries(tracks).every(([trackId, track]) => track.id === trackId),
      "Snapshot tracks must contain main and use matching map keys",
    ),
  runAllActive: z.boolean(),
  stopRequested: z.boolean(),
  cycle: z.number().int().nonnegative(),
  answersByCycle: z.array(z.record(z.string())),
  outputs: z.record(zOutputEntry),
  cellRuns: z.record(zCellRun),
  execCounter: z.number().int().nonnegative(),
  effectSeq: z.number().int().nonnegative(),
  inFlight: z.record(zInFlight).refine((entries) => Object.keys(entries).length === 0),
  cancellingEffectIds: z
    .record(z.literal(true))
    .refine((entries) => Object.keys(entries).length === 0),
  devices: z.array(zDevice),
  fatalReason: z.string().nullable(),
  trace: z.array(z.string()),
});

export const zWorkbookSnapshot = z.object({
  schemaVersion: z.literal(2),
  savedAt: z.number(),
  cellsHash: z.string(),
  state: zSnapshotStateV2,
});

export interface WorkbookSnapshot {
  schemaVersion: 2;
  savedAt: number;
  cellsHash: string;
  state: Omit<RunnerState, "outputs"> & { outputs: Record<string, SnapshotOutputEntry> };
}

/** FNV-1a over the serialized program; detects resume-against-edited-cells. */
export function hashCells(cells: unknown): string {
  const text = JSON.stringify(cells);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Freeze pure JSON. Every in-flight owner is re-armed as `interrupted`; no
 * physical command auto-resumes after restore. Track-local progress,
 * dispatch queues, cancellation membership and connection ids are volatile.
 */
export function toSnapshot(state: RunnerState, savedAt: number): WorkbookSnapshot {
  let frozen = structuredClone(state) as unknown as WorkbookSnapshot["state"];
  frozen.devices = [];
  frozen.runAllActive = false;
  frozen.stopRequested = false;
  frozen.cancellingEffectIds = {};

  for (const [trackId, sourceTrack] of Object.entries(state.tracks)) {
    const track = frozen.tracks[trackId];
    track.progress = null;
    track.deviceIds = [];
    if (sourceTrack.dispatch !== null) {
      const branchId = sourceTrack.dispatch.branchCellId;
      const prev = frozen.cellRuns[branchId];
      frozen.cellRuns[branchId] = {
        status: "interrupted",
        executionOrder: prev?.executionOrder ?? [],
      };
      track.dispatch = null;
    }
    frozen.tracks[trackId] = track;
  }

  for (const effect of Object.values(state.inFlight).filter((entry) => entry !== undefined)) {
    const owner = ownerCellId(effect.cellId);
    for (const id of new Set([effect.cellId, owner])) {
      const prev = frozen.cellRuns[id];
      frozen.cellRuns[id] = {
        status: "interrupted",
        executionOrder: prev?.executionOrder ?? [],
      };
    }
    const track = frozen.tracks[effect.trackId];
    const pendingInteraction: PendingInteraction | null =
      state.mode === "flow" ? { kind: "resume", cellId: owner } : null;
    frozen.tracks[effect.trackId] = {
      ...track,
      status: state.mode === "flow" ? "awaitingHuman" : "active",
      pendingInteraction,
      cursor: { ...track.cursor, cellId: owner },
    };
  }
  frozen.inFlight = {};
  frozen = withDerivedStatus(frozen as RunnerState) as WorkbookSnapshot["state"];

  return {
    schemaVersion: 2,
    savedAt,
    cellsHash: hashCells(state.cells),
    state: frozen,
  };
}

function interactionForV1(state: z.infer<typeof zSnapshotStateV1>): PendingInteraction | null {
  const cellId = state.position.cellId;
  if (!cellId) return null;
  if (state.status === "pausedError") return { kind: "error", cellId };
  if (state.status !== "awaitingInput") return null;
  const cell = state.cells.find((candidate) => candidate.id === cellId);
  if (cell?.type === "question") return { kind: "question", cellId };
  if (cell?.type === "markdown") return { kind: "instruction", cellId };
  return { kind: "resume", cellId };
}

/** Lossless v1 paused-run migration into the production main track. */
function migrateV1(raw: Record<string, unknown>): Record<string, unknown> {
  const parsed = zWorkbookSnapshotV1.safeParse(raw);
  if (!parsed.success) {
    throw new SnapshotError("invalid", `Snapshot failed validation: ${parsed.error.message}`);
  }
  const old = parsed.data;
  const s = old.state;
  const pendingInteraction = interactionForV1(s);
  const track: Track = {
    id: MAIN_TRACK_ID,
    deviceIds: s.devices.map((device) => device.id),
    cursor: { body: [], ...s.position },
    status:
      s.status === "done"
        ? "done"
        : s.status === "pausedError"
          ? "failed"
          : pendingInteraction
            ? "awaitingHuman"
            : "active",
    terminalReason:
      s.status === "pausedError" && s.position.cellId
        ? s.cellRuns[s.position.cellId].error
        : undefined,
    branchVisits: s.branchVisits,
    returnStack: s.returnStack,
    dispatch: s.dispatch,
    dispatchConsumed: s.dispatchConsumed,
    progress: s.progress,
    pendingInteraction,
  };
  const state: RunnerState = withDerivedStatus({
    schemaVersion: 2,
    mode: s.mode,
    options: s.options,
    cells: s.cells as unknown as RunnerState["cells"],
    status: s.status,
    tracks: { [MAIN_TRACK_ID]: track },
    runAllActive: s.runAllActive,
    stopRequested: s.stopRequested,
    cycle: s.cycle,
    answersByCycle: s.answersByCycle,
    outputs: s.outputs as unknown as RunnerState["outputs"],
    cellRuns: s.cellRuns,
    execCounter: s.execCounter,
    effectSeq: s.effectSeq,
    inFlight: {},
    cancellingEffectIds: {},
    devices: s.devices,
    fatalReason: s.fatalReason,
    trace: [...s.trace, "migrated snapshot v1 to tracks.main"],
  });
  return {
    schemaVersion: 2,
    savedAt: old.savedAt,
    cellsHash: old.cellsHash,
    state,
  };
}

type Migration = (snapshot: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: Partial<Record<number, Migration>> = { 1: migrateV1 };

/** Validate a persisted snapshot and migrate older supported versions. */
export function parseSnapshot(raw: unknown): WorkbookSnapshot {
  if (raw === null || typeof raw !== "object") {
    throw new SnapshotError("invalid", "Snapshot must be an object");
  }
  let candidate = raw as Record<string, unknown>;
  const version = candidate.schemaVersion;
  if (typeof version !== "number") {
    throw new SnapshotError("invalid", "Snapshot has no schemaVersion");
  }
  if (version > 2) {
    throw new SnapshotError(
      "unsupportedVersion",
      `Snapshot schemaVersion ${version} is newer than this runtime`,
    );
  }
  for (let v = version; v < 2; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) {
      throw new SnapshotError("unsupportedVersion", `No migration from schemaVersion ${v}`);
    }
    candidate = migrate(candidate);
  }
  const parsed = zWorkbookSnapshot.safeParse(candidate);
  if (!parsed.success) {
    throw new SnapshotError("invalid", `Snapshot failed validation: ${parsed.error.message}`);
  }
  const snapshot = parsed.data as unknown as WorkbookSnapshot;
  snapshot.state = withDerivedStatus(snapshot.state as RunnerState) as WorkbookSnapshot["state"];
  return snapshot;
}
