import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

// Terminal states injected by the builder (not backed by a cell).
export const DONE = "__done__";
export const ERROR = "__error__";

// The companion state a macro routes to when it returns a constructed protocol
// to dispatch (vs falling straight through to its sequential next).
export function macroDispatchId(macroCellId: string): string {
  return `${macroCellId}__dispatch`;
}

// The spawned actor running the macro-constructed protocol. The dispatch state
// waits for its `xstate.done.actor.<id>` event.
export function dispatchChildId(macroCellId: string): string {
  return `dispatch__${macroCellId}`;
}

// Cells that become a step the runtime stops on. `output` cells carry results
// but are not visited (mirrors cells-to-flow.ts returning null for them).
const EXECUTABLE = new Set(["protocol", "macro", "question", "markdown", "branch"]);

export function isExecutable(cell: WorkbookCell): boolean {
  return EXECUTABLE.has(cell.type);
}

export function executableCells(cells: WorkbookCell[]): WorkbookCell[] {
  return cells.filter(isExecutable);
}

// The next step in document order, skipping output cells, or DONE at the end.
// This is the sequential fall-through used when no branch jump applies.
export function nextStateId(cells: WorkbookCell[], cellId: string): string {
  const order = executableCells(cells);
  const idx = order.findIndex((c) => c.id === cellId);
  if (idx < 0 || idx + 1 >= order.length) return DONE;
  return order[idx + 1].id;
}

// A branch `gotoCellId` is only a valid jump target if it resolves to a visited
// step. Pointing at an output cell (or a missing id) falls through, exactly like
// evaluate-and-route's `findIndex` returning -1.
export function resolveGotoStateId(cells: WorkbookCell[], gotoCellId: string): string | null {
  const target = cells.find((c) => c.id === gotoCellId);
  return target && isExecutable(target) ? target.id : null;
}

// The nearest measurement (protocol) cell before `cellId` in document order.
// A macro runs against that scan's output (exposed to macro code as `json`),
// matching production's applyMacro(scanResult, macro). null if none precedes it.
export function nearestUpstreamMeasurementId(
  cells: WorkbookCell[],
  cellId: string,
): string | null {
  const idx = cells.findIndex((c) => c.id === cellId);
  for (let i = idx - 1; i >= 0; i--) {
    if (cells[i].type === "protocol") return cells[i].id;
  }
  return null;
}

// Reconstruct the workbook cells with live runtime values folded back in, so the
// production `evaluateBranch` (which reads question.answer and output.data) sees
// current state. This is the spike's equivalent of mobile's `hydrateCells`.
export function hydrateCells(
  cells: WorkbookCell[],
  answers: Record<string, string>,
  outputs: Record<string, unknown>,
): WorkbookCell[] {
  return cells.map((cell) => {
    if (cell.type === "question") {
      const answer = answers[cell.id];
      return answer === undefined ? cell : { ...cell, answer, isAnswered: true };
    }
    if (cell.type === "output") {
      const data = outputs[cell.producedBy];
      return data === undefined ? cell : { ...cell, data };
    }
    return cell;
  });
}
