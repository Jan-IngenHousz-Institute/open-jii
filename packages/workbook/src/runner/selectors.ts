import type { OutputCell } from "@repo/api/schemas/workbook-cells.schema";

import type { RunnerCell } from "../cells";
import { cellIndex, isProducer } from "../flow/flow-utils";
import { normalizeOutputData } from "../flow/normalize-output";
import type { CommandProgress } from "../ports/command-executor";
import { lastOrder, ownerCellId } from "./cell-entry";
import type { RunnerState } from "./state";

export function getCurrentCell(state: RunnerState): RunnerCell | undefined {
  const id = state.position.cellId;
  return id === null ? undefined : state.cells.find((c) => c.id === id);
}

export function getAnswers(
  state: RunnerState,
  cycle: number = state.cycle,
): Partial<Record<string, string>> {
  return state.answersByCycle[cycle] ?? {};
}

/** Verbatim executor/macro response for a producer (or dispatch step). */
export function getOutputRaw(state: RunnerState, producerId: string): unknown {
  return state.outputs[producerId]?.v;
}

/** The normalized first-sample view branch conditions and ctx read. */
export function getOutputView(state: RunnerState, producerId: string): unknown {
  const entry = state.outputs[producerId];
  return entry === undefined ? undefined : normalizeOutputData(entry.v);
}

export function isCellStale(state: RunnerState, cellId: string): boolean {
  return state.cellRuns[cellId]?.status === "stale";
}

export function getProgress(state: RunnerState): CommandProgress | null {
  return state.progress;
}

export function isDone(state: RunnerState): boolean {
  return state.status === "done";
}

export function getMatchedPathId(state: RunnerState, branchCellId: string): string | undefined {
  return state.cellRuns[branchCellId]?.lastMatchedPathId;
}

/**
 * Web-compatible view: the cell list with one output cell per produced value,
 * inserted after its producer (dispatch outputs follow the owning macro).
 * Program output cells for a producer are replaced by the live one. Derived
 * on demand; runtime state never mutates the program.
 */
export function materializeCells(state: RunnerState): RunnerCell[] {
  const produced = new Set(Object.keys(state.outputs));
  const errored = Object.entries(state.cellRuns)
    .filter(([, run]) => run?.status === "error" && run.error !== undefined)
    .map(([id]) => id);

  const byOwner = new Map<string, string[]>();
  for (const key of [...produced, ...errored]) {
    const owner = ownerCellId(key);
    if (cellIndex(state.cells, owner) < 0) continue;
    const list = byOwner.get(owner) ?? [];
    if (!list.includes(key)) list.push(key);
    byOwner.set(owner, list);
  }

  const result: RunnerCell[] = [];
  for (const cell of state.cells) {
    if (cell.type === "output" && byOwner.has(ownerCellId(cell.producedBy))) {
      continue; // replaced by the live output below
    }
    result.push(cell);
    const keys = byOwner.get(cell.id);
    if (!keys || !isProducer(cell)) continue;
    // Owner first, dispatch step second, mirroring execution order.
    keys.sort((a, b) => a.length - b.length);
    for (const key of keys) {
      const run = state.cellRuns[key];
      const entry = state.outputs[key];
      const output: OutputCell = {
        id: `out:${key}:${state.cycle}:${lastOrder(run)}`,
        type: "output",
        isCollapsed: false,
        producedBy: key,
        data: entry === undefined ? undefined : entry.v,
        executionTime: run?.executionTimeMs,
        messages: run?.status === "error" && run.error !== undefined ? [run.error] : undefined,
      };
      result.push(output);
    }
  }
  return result;
}
