import type { OutputCell } from "@repo/api/schemas/workbook-cells.schema";

import type { RunnerCell } from "../cells";
import { isProducer } from "../flow/flow-utils";
import { lastOrder, ownerCellId } from "./cell-entry";
import type { CellRunStatus, CreateStateOptions, RunnerState } from "./state";
import { createInitialState } from "./state";

// Host-view helpers: fold runner state back onto a host's persisted cell
// array and derive per-cell display info. Pure and host-neutral.

function sameStringArray(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameOutputCell(existing: OutputCell, desired: OutputCell): boolean {
  return (
    Object.is(existing.data, desired.data) &&
    existing.executionTime === desired.executionTime &&
    sameStringArray(existing.messages, desired.messages)
  );
}

/** Seed runner outputs from persisted output cells so macros/branches see them. */
export function outputsFromCells(cells: RunnerCell[]): RunnerState["outputs"] {
  const byId = new Map(cells.map((c) => [c.id, c]));
  const outputs: RunnerState["outputs"] = {};
  for (const cell of cells) {
    if (cell.type !== "output" || cell.data == null) continue;
    const owner = byId.get(ownerCellId(cell.producedBy));
    if (owner && isProducer(owner)) outputs[cell.producedBy] = { v: cell.data };
  }
  return outputs;
}

/**
 * Initial runner state for a (possibly edited) cell array: outputs seed from
 * persisted output cells, and a previous runner's outputs, run records and
 * counters carry over by stable cell id so edits do not reset them.
 */
export function carryOverState(
  opts: CreateStateOptions,
  prev: Readonly<RunnerState> | null,
): RunnerState {
  const base = createInitialState(opts);
  const outputs = outputsFromCells(opts.cells);
  if (!prev) return { ...base, outputs };

  const ids = new Set(opts.cells.map((c) => c.id));
  for (const [key, entry] of Object.entries(prev.outputs)) {
    if (entry && ids.has(ownerCellId(key))) outputs[key] = entry;
  }
  const cellRuns: RunnerState["cellRuns"] = {};
  for (const [key, run] of Object.entries(prev.cellRuns)) {
    if (run && run.status !== "running" && ids.has(ownerCellId(key))) cellRuns[key] = run;
  }
  return {
    ...base,
    outputs,
    cellRuns,
    execCounter: prev.execCounter,
    effectSeq: prev.effectSeq,
  };
}

/**
 * Fold runner results into the latest cell array: one output cell per produced
 * value (or per-cell error) inserted after its producer, replacing any previous
 * output for the same producer; branch cells get `evaluatedPathId` plus a
 * message output. Unmanaged output cells pass through untouched, unchanged
 * outputs keep their cell objects, and `latest` itself returns when nothing
 * changed, so merging is idempotent.
 */
export function mergeCellsView(latest: RunnerCell[], state: Readonly<RunnerState>): RunnerCell[] {
  const byId = new Map(latest.map((c) => [c.id, c]));
  const managed = new Map<string, OutputCell>();
  const byOwner = new Map<string, string[]>();

  const keys = new Set(Object.keys(state.outputs));
  for (const [key, run] of Object.entries(state.cellRuns)) {
    if (run?.status === "error" && run.error !== undefined) keys.add(key);
  }

  for (const key of keys) {
    const ownerId = ownerCellId(key);
    const owner = byId.get(ownerId);
    if (!owner || !isProducer(owner)) continue;
    const run = state.cellRuns[key];
    const entry = state.outputs[key];
    const failed = run?.status === "error" && run.error !== undefined;
    if (entry === undefined && !failed) continue;
    managed.set(key, {
      id: `out:${key}:${state.cycle}:${lastOrder(run)}`,
      type: "output",
      isCollapsed: false,
      producedBy: key,
      data: entry?.v,
      executionTime: run?.executionTimeMs,
      messages: failed ? [run.error ?? "Execution failed"] : undefined,
    });
    byOwner.set(ownerId, [...(byOwner.get(ownerId) ?? []), key]);
  }

  for (const cell of latest) {
    if (cell.type !== "branch") continue;
    const run = state.cellRuns[cell.id];
    if (run?.status !== "completed") continue;
    const matched = run.lastMatchedPathId
      ? cell.paths.find((p) => p.id === run.lastMatchedPathId)
      : undefined;
    managed.set(cell.id, {
      id: `out:${cell.id}:${state.cycle}:${lastOrder(run)}`,
      type: "output",
      isCollapsed: false,
      producedBy: cell.id,
      data: undefined,
      executionTime: 0,
      messages: [matched ? `Matched: ${matched.label || "Unnamed path"}` : "No path matched"],
    });
    byOwner.set(cell.id, [cell.id]);
  }

  const existingByKey = new Map<string, OutputCell>();
  for (const cell of latest) {
    if (cell.type === "output" && managed.has(cell.producedBy)) {
      existingByKey.set(cell.producedBy, cell);
    }
  }

  const result: RunnerCell[] = [];
  for (const cell of latest) {
    if (cell.type === "output" && managed.has(cell.producedBy)) continue;
    let rendered: RunnerCell = cell;
    if (cell.type === "branch") {
      const run = state.cellRuns[cell.id];
      if (run?.status === "completed" && cell.evaluatedPathId !== run.lastMatchedPathId) {
        rendered = { ...cell, evaluatedPathId: run.lastMatchedPathId };
      }
    }
    result.push(rendered);
    const ownedKeys = byOwner.get(cell.id);
    if (!ownedKeys) continue;
    // Owner first, dispatch step second, mirroring execution order.
    ownedKeys.sort((a, b) => a.length - b.length);
    for (const key of ownedKeys) {
      const desired = managed.get(key);
      if (!desired) continue;
      const existing = existingByKey.get(key);
      result.push(existing && sameOutputCell(existing, desired) ? existing : desired);
    }
  }
  const unchanged = result.length === latest.length && result.every((c, i) => c === latest[i]);
  return unchanged ? latest : result;
}

export interface CellViewRun {
  status: CellRunStatus;
  error?: string;
  /** Jupyter-style: each run appends the global counter value. */
  executionOrder?: number[];
}

/**
 * Per-cell effective run for display. Dispatch steps (macro-constructed
 * commands) never surface as their own entry: a running one shows on its
 * macro. The question a host is currently prompting for shows as running.
 */
export function effectiveCellRuns(
  state: Readonly<RunnerState> | null,
  promptingCellId?: string | null,
): Record<string, CellViewRun> {
  const runs: Record<string, CellViewRun> = {};
  if (state) {
    for (const [key, run] of Object.entries(state.cellRuns)) {
      if (!run || ownerCellId(key) !== key) continue;
      runs[key] = { status: run.status, error: run.error, executionOrder: run.executionOrder };
    }
    for (const [key, run] of Object.entries(state.cellRuns)) {
      const owner = ownerCellId(key);
      if (!run || owner === key || run.status !== "running") continue;
      runs[owner] = { ...runs[owner], status: "running" };
    }
  }
  if (promptingCellId) {
    runs[promptingCellId] = { ...runs[promptingCellId], status: "running" };
  }
  return runs;
}
