import { z } from "zod";

import { ownerCellId } from "./cell-entry";
import type { RunnerState } from "./state";

export type SnapshotErrorCode = "invalid" | "unsupportedVersion" | "cellsMismatch" | "missingStore";

export class SnapshotError extends Error {
  readonly code: SnapshotErrorCode;
  constructor(code: SnapshotErrorCode, message: string) {
    super(message);
    this.name = "SnapshotError";
    this.code = code;
  }
}

// Ref variant first: `v: z.unknown()` also matches a bare `{ ref }` object
// (unknown treats the key as optional) and would silently strip the ref.
const zOutputEntry = z.union([
  z.object({ ref: z.string() }).strict(),
  z.object({ v: z.unknown() }),
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

const zSnapshotState = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(["flow", "notebook"]),
  options: z.object({
    loop: z.boolean(),
    maxBranchVisits: z.number(),
    allowDeviceWrites: z.boolean(),
    deviceFamily: z.enum(["multispeq", "ambit", "generic"]).optional(),
  }),
  cells: z.array(zLooseCell),
  status: z.enum([
    "idle",
    "awaitingInput",
    "running",
    "cancelling",
    "pausedError",
    "done",
    "fatal",
  ]),
  position: z.object({
    cellId: z.string().nullable(),
    enteredVia: z.enum(["forward", "back", "jump"]),
    atStart: z.boolean(),
  }),
  runAllActive: z.boolean(),
  stopRequested: z.boolean(),
  cycle: z.number().int().nonnegative(),
  answersByCycle: z.array(z.record(z.string())),
  outputs: z.record(zOutputEntry),
  branchVisits: z.record(z.number()),
  returnStack: z.array(
    z.object({ landingCellId: z.string(), returnToCellId: z.string().nullable() }),
  ),
  cellRuns: z.record(zCellRun),
  execCounter: z.number().int().nonnegative(),
  effectSeq: z.number().int().nonnegative(),
  inFlight: z.null(),
  progress: z.null(),
  fatalReason: z.string().nullable(),
  trace: z.array(z.string()),
});

export const zWorkbookSnapshot = z.object({
  schemaVersion: z.literal(1),
  savedAt: z.number(),
  cellsHash: z.string(),
  state: zSnapshotState,
});

export interface WorkbookSnapshot {
  schemaVersion: 1;
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
 * Freeze the state as pure JSON. In-flight work is never serialized as
 * running: the cell re-arms as `interrupted` and the host re-triggers after
 * restore (a mid-scan app kill must not auto-resend a device command).
 * Volatile progress is stripped.
 */
export function toSnapshot(state: RunnerState, savedAt: number): WorkbookSnapshot {
  const frozen = structuredClone(state) as unknown as WorkbookSnapshot["state"];
  frozen.progress = null;
  if (state.inFlight !== null) {
    const effectCell = state.inFlight.cellId;
    const owner = ownerCellId(effectCell);
    for (const id of new Set([effectCell, owner])) {
      const prev = frozen.cellRuns[id];
      frozen.cellRuns[id] = {
        status: "interrupted",
        executionOrder: prev?.executionOrder ?? [],
      };
    }
    frozen.inFlight = null;
    frozen.status = state.mode === "flow" ? "awaitingInput" : "idle";
    frozen.position = { ...frozen.position, cellId: owner };
    frozen.runAllActive = false;
    frozen.stopRequested = false;
  } else if (state.status === "running" || state.status === "cancelling") {
    frozen.status = state.mode === "flow" ? "awaitingInput" : "idle";
  }
  return {
    schemaVersion: 1,
    savedAt,
    cellsHash: hashCells(state.cells),
    state: frozen,
  };
}

type Migration = (snapshot: Record<string, unknown>) => Record<string, unknown>;

/** Seam for future format upgrades; keyed by the version being upgraded FROM. */
const MIGRATIONS: Partial<Record<number, Migration>> = {};

/**
 * Validate a persisted snapshot. Ref-shaped outputs are left as-is; the
 * caller (WorkbookRunner.restore) inflates them through the OutputStorePort.
 */
export function parseSnapshot(raw: unknown): WorkbookSnapshot {
  if (raw === null || typeof raw !== "object") {
    throw new SnapshotError("invalid", "Snapshot must be an object");
  }
  let candidate = raw as Record<string, unknown>;
  const version = candidate.schemaVersion;
  if (typeof version !== "number") {
    throw new SnapshotError("invalid", "Snapshot has no schemaVersion");
  }
  if (version > 1) {
    throw new SnapshotError(
      "unsupportedVersion",
      `Snapshot schemaVersion ${version} is newer than this runtime`,
    );
  }
  for (let v = version; v < 1; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate)
      throw new SnapshotError("unsupportedVersion", `No migration from schemaVersion ${v}`);
    candidate = migrate(candidate);
  }
  const parsed = zWorkbookSnapshot.safeParse(candidate);
  if (!parsed.success) {
    throw new SnapshotError("invalid", `Snapshot failed validation: ${parsed.error.message}`);
  }
  return parsed.data as unknown as WorkbookSnapshot;
}
