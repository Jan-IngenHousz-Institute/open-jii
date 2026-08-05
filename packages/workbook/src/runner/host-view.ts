import type { OutputCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { resolveBranchPathById } from "@repo/api/transforms/evaluate-branch";
import { sanitizeQuestionLabel } from "@repo/api/transforms/label-sanitization";
import {
  findWorkbookCell,
  findWorkbookCellInBody,
  walkWorkbookCells,
} from "@repo/api/transforms/workbook-cell-tree";

import type { RunnerCell } from "../cells";
import { isProducer } from "../flow/flow-utils";
import { lastOrder, ownerCellId } from "./cell-entry";
import type { CellRunStatus, CreateStateOptions, ParallelContextEntry, RunnerState } from "./state";
import { createInitialState, currentAnswers } from "./state";

// Host-view helpers: fold runner state back onto a host's persisted cell
// array and derive per-cell display info. Pure and host-neutral.

function sameStringArray(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameOutputData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  // Question `{ answer }` blocks are rebuilt per merge; compare by value.
  if (a == null || b == null || typeof a !== "object" || typeof b !== "object") return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === 1 &&
    keysB.length === 1 &&
    keysA[0] === "answer" &&
    keysB[0] === "answer" &&
    (a as { answer?: unknown }).answer === (b as { answer?: unknown }).answer
  );
}

function sameOutputCell(existing: OutputCell, desired: OutputCell): boolean {
  return (
    sameOutputData(existing.data, desired.data) &&
    existing.executionTime === desired.executionTime &&
    sameStringArray(existing.messages, desired.messages) &&
    Object.is(existing.deviceResults, desired.deviceResults)
  );
}

/** Seed runner outputs from persisted output cells so macros/branches see them. */
export function outputsFromCells(cells: RunnerCell[]): RunnerState["outputs"] {
  const outputs: RunnerState["outputs"] = {};
  for (const location of walkWorkbookCells(cells)) {
    const { cell } = location;
    if (cell.type !== "output") continue;
    if (cell.data == null && !cell.deviceResults?.length) continue;
    const owner = findWorkbookCellInBody(cells, {
      path: location.path,
      cellId: ownerCellId(cell.producedBy),
    })?.cell;
    if (owner && isProducer(owner)) {
      outputs[cell.producedBy] = { v: cell.data, deviceResults: cell.deviceResults };
    }
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

  const ids = new Set(walkWorkbookCells(opts.cells).map(({ cell }) => cell.id));
  for (const [key, entry] of Object.entries(prev.outputs)) {
    if (entry && ids.has(ownerCellId(key))) outputs[key] = entry;
  }
  const cellRuns: RunnerState["cellRuns"] = {};
  for (const [key, run] of Object.entries(prev.cellRuns)) {
    if (run && run.status !== "running" && ids.has(ownerCellId(key))) cellRuns[key] = run;
  }
  const parallelContexts: RunnerState["parallelContexts"] = {};
  for (const { cell } of walkWorkbookCells(opts.cells)) {
    if (cell.type !== "parallel") continue;
    const value = outputs[cell.id]?.v;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      parallelContexts[sanitizeQuestionLabel(cell.name)] = value as ParallelContextEntry;
    }
  }
  return {
    ...base,
    outputs,
    cellRuns,
    execCounter: prev.execCounter,
    effectSeq: prev.effectSeq,
    containerAttemptSeq: prev.containerAttemptSeq,
    parallelAttempts: Object.fromEntries(
      Object.entries(prev.parallelAttempts).filter(([, attempt]) => attempt?.status === "complete"),
    ),
    parallelContexts,
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
  const managed = new Map<string, OutputCell>();
  const byOwner = new Map<string, string[]>();

  const keys = new Set(Object.keys(state.outputs));
  for (const [key, run] of Object.entries(state.cellRuns)) {
    if (run?.status === "error" && run.error !== undefined) keys.add(key);
  }

  for (const key of keys) {
    const ownerId = ownerCellId(key);
    const owner = findWorkbookCell(latest, ownerId)?.cell;
    if (!owner || !(isProducer(owner) || owner.type === "question")) continue;
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
      deviceResults: entry?.deviceResults,
      executionTime: run?.executionTimeMs,
      messages: failed ? (entry?.messages ?? [run.error ?? "Execution failed"]) : entry?.messages,
    });
    byOwner.set(ownerId, [...(byOwner.get(ownerId) ?? []), key]);
  }

  for (const { cell } of walkWorkbookCells(latest)) {
    if (cell.type !== "branch") continue;
    const run = state.cellRuns[cell.id];
    if (run?.status === "error" && run.error !== undefined) {
      // Config-validation and no-device failures surface on the branch output.
      managed.set(cell.id, {
        id: `out:${cell.id}:${state.cycle}:${lastOrder(run)}`,
        type: "output",
        isCollapsed: false,
        producedBy: cell.id,
        data: undefined,
        executionTime: 0,
        messages: run.error.split("; "),
      });
      byOwner.set(cell.id, [cell.id]);
      continue;
    }
    if (run?.status !== "completed") continue;
    const matchedResolution = resolveBranchPathById(cell.paths, run.lastMatchedPathId);
    const matched = matchedResolution.status === "resolved" ? matchedResolution.path : undefined;
    // A device dispatch records its own summary lines in the output entry.
    const dispatchMessages = state.outputs[cell.id]?.messages;
    managed.set(cell.id, {
      id: `out:${cell.id}:${state.cycle}:${lastOrder(run)}`,
      type: "output",
      isCollapsed: false,
      producedBy: cell.id,
      data: undefined,
      executionTime: 0,
      messages: dispatchMessages ?? [
        matched ? `Matched: ${matched.label || "Unnamed path"}` : "No path matched",
      ],
    });
    byOwner.set(cell.id, [cell.id]);
  }

  // Web parity: an answered question folds its answer back onto the cell and
  // gets an `{ answer }` output block.
  const answers = currentAnswers(state);
  for (const { cell } of walkWorkbookCells(latest)) {
    if (cell.type !== "question") continue;
    const answer = answers[cell.id];
    if (answer === undefined) continue;
    const run = state.cellRuns[cell.id];
    managed.set(cell.id, {
      id: `out:${cell.id}:${state.cycle}:${lastOrder(run)}`,
      type: "output",
      isCollapsed: false,
      producedBy: cell.id,
      data: { answer },
      executionTime: 0,
      messages: undefined,
    });
    byOwner.set(cell.id, [cell.id]);
  }

  const existingByKey = new Map<string, OutputCell>();
  for (const location of walkWorkbookCells(latest)) {
    const { cell } = location;
    if (
      cell.type === "output" &&
      managed.has(cell.producedBy) &&
      location.body.some((candidate) => candidate.id === ownerCellId(cell.producedBy))
    ) {
      existingByKey.set(cell.producedBy, cell);
    }
  }

  const renderBody = (body: RunnerCell[]): RunnerCell[] => {
    const result: RunnerCell[] = [];
    const bodyIds = new Set(body.map((cell) => cell.id));
    for (const cell of body) {
      if (
        cell.type === "output" &&
        managed.has(cell.producedBy) &&
        bodyIds.has(ownerCellId(cell.producedBy))
      ) {
        const desired = managed.get(cell.producedBy);
        if (desired) result.push(sameOutputCell(cell, desired) ? cell : desired);
        continue;
      }

      let rendered: RunnerCell = cell;
      if (cell.type === "parallel") {
        const lanes = cell.lanes.map((lane) => {
          const nextBody = renderBody(lane.body) as typeof lane.body;
          if (nextBody === lane.body) return lane;
          return { ...lane, body: nextBody };
        });
        if (lanes.some((lane, index) => lane !== cell.lanes[index])) {
          rendered = { ...cell, lanes };
        }
      } else if (cell.type === "branch") {
        const run = state.cellRuns[cell.id];
        if (run?.status === "completed" || run?.status === "error") {
          const matched = resolveBranchPathById(cell.paths, run.lastMatchedPathId);
          if (matched.status === "resolved") {
            if (cell.evaluatedPathId !== matched.path.id || !("evaluatedPathId" in cell)) {
              rendered = { ...cell, evaluatedPathId: matched.path.id };
            }
          } else if ("evaluatedPathId" in cell) {
            const cleared = { ...cell };
            delete cleared.evaluatedPathId;
            rendered = cleared;
          }
        }
      } else if (cell.type === "question") {
        const answer = answers[cell.id];
        if (answer !== undefined && (cell.answer !== answer || !cell.isAnswered)) {
          rendered = { ...cell, answer, isAnswered: true };
        }
      }
      result.push(rendered);

      const ownedKeys = byOwner.get(cell.id);
      if (!ownedKeys) continue;
      // Existing outputs retain their current index. Only a newly materialized
      // output is inserted after its owner, keeping byte-identical round trips.
      for (const key of [...ownedKeys].sort((a, b) => a.length - b.length)) {
        if (existingByKey.has(key)) continue;
        const desired = managed.get(key);
        if (desired) result.push(desired);
      }
    }
    const unchanged =
      result.length === body.length && result.every((cell, index) => cell === body[index]);
    return unchanged ? body : result;
  };

  const result = renderBody(latest);
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
