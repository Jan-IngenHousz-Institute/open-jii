import type {
  BranchCell,
  OutputCell,
  QuestionCell,
  WorkbookCell,
} from "@repo/api/schemas/workbook-cells.schema";
import { evaluateBranch, validateBranchCell } from "@repo/api/utils/evaluate-branch";

export type CellExecutionStatus = "idle" | "running" | "completed" | "error";

export interface CellExecutionState {
  status: CellExecutionStatus;
  error?: string;
  // Jupyter-style: each run appends the global counter value.
  executionOrder?: number[];
}

export type ExecutionStates = Record<string, CellExecutionState>;

/** A transition's result: next cells plus the cell's next execution state. */
export interface ExecutionFold {
  cells: WorkbookCell[];
  state: Omit<CellExecutionState, "executionOrder">;
}

// --- execution-state transitions ---

/** Replaces a cell's status/error while preserving its execution order. */
export function applyCellState(
  states: ExecutionStates,
  cellId: string,
  state: Omit<CellExecutionState, "executionOrder">,
): ExecutionStates {
  const existing = states[cellId];
  return { ...states, [cellId]: { ...state, executionOrder: existing.executionOrder } };
}

/** Marks a cell running and appends the global execution counter value. */
export function stampExecutionStart(
  states: ExecutionStates,
  cellId: string,
  order: number,
): ExecutionStates {
  const existing = states[cellId] as CellExecutionState | undefined;
  const prevOrder = existing?.executionOrder ?? [];
  return {
    ...states,
    [cellId]: { ...existing, status: "running", executionOrder: [...prevOrder, order] },
  };
}

// --- runnable/blocked predicates & run-order derivation ---

// Cap revisits to avoid infinite loops from branch jumps.
export const MAX_VISITS_PER_CELL = 100;

/** Output and markdown cells are never executed. */
export function isRunnableCell(cell: WorkbookCell): boolean {
  return cell.type !== "output" && cell.type !== "markdown";
}

/** Counts a visit; blocked visits leave the counts unchanged. `pass` is 1-based. */
export function recordVisit(
  counts: Record<string, number>,
  cellId: string,
): { counts: Record<string, number>; pass: number; blocked: boolean } {
  const count = counts[cellId] ?? 0;
  if (count >= MAX_VISITS_PER_CELL) return { counts, pass: count, blocked: true };
  return { counts: { ...counts, [cellId]: count + 1 }, pass: count + 1, blocked: false };
}

export function hasQuestionText(cell: QuestionCell): boolean {
  return cell.question.text.trim().length > 0;
}

/** Nearest output data above the given index — a macro cell's input. */
export function findPrecedingOutputData(
  cells: WorkbookCell[],
  beforeIndex: number,
): Record<string, unknown> | null {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.type === "output" && c.data) {
      return c.data as Record<string, unknown>;
    }
  }
  return null;
}

/** Returns the jump index into `cells` from an evaluated branch, or -1 if no jump. */
export function resolveBranchJump(branchCellId: string, cells: WorkbookCell[]): number {
  const branch = cells.find((c) => c.id === branchCellId);
  if (branch?.type !== "branch" || !branch.evaluatedPathId) return -1;
  const matchedPath = branch.paths.find((p) => p.id === branch.evaluatedPathId);
  if (!matchedPath?.gotoCellId) return -1;
  return cells.findIndex((c) => c.id === matchedPath.gotoCellId);
}

// --- output construction & result/error folding ---

export function makeOutputCell(
  producedBy: string,
  data: Record<string, unknown> | undefined,
  executionTime: number,
  messages: string[],
): OutputCell {
  return {
    id: crypto.randomUUID(),
    type: "output",
    isCollapsed: false,
    producedBy,
    data,
    executionTime,
    messages,
  };
}

export function makeErrorOutputCell(
  producedBy: string,
  error: string,
  executionTime = 0,
): OutputCell {
  return makeOutputCell(producedBy, undefined, executionTime, [error]);
}

// Replaces any previous output produced by the same source cell.
export function insertOutputAfterCell(
  currentCells: WorkbookCell[],
  sourceCellId: string,
  outputCell: OutputCell,
): WorkbookCell[] {
  const filtered = currentCells.filter(
    (c) => !(c.type === "output" && c.producedBy === sourceCellId),
  );
  const idx = filtered.findIndex((c) => c.id === sourceCellId);
  const updated = [...filtered];
  updated.splice(idx + 1, 0, outputCell);
  return updated;
}

export function foldExecutionSuccess(
  cells: WorkbookCell[],
  cellId: string,
  data: Record<string, unknown> | undefined,
  executionTime: number,
): ExecutionFold {
  return {
    cells: insertOutputAfterCell(cells, cellId, makeOutputCell(cellId, data, executionTime, [])),
    state: { status: "completed" },
  };
}

// `outputMessage` lets the output cell carry a longer hint than the state error.
export function foldExecutionError(
  cells: WorkbookCell[],
  cellId: string,
  error: string,
  options: { outputMessage?: string; executionTime?: number } = {},
): ExecutionFold {
  const { outputMessage = error, executionTime = 0 } = options;
  return {
    cells: insertOutputAfterCell(
      cells,
      cellId,
      makeErrorOutputCell(cellId, outputMessage, executionTime),
    ),
    state: { status: "error", error },
  };
}

/** Records the answer on the question cell and emits its `{ answer }` output. */
export function foldQuestionAnswered(
  cells: WorkbookCell[],
  cell: QuestionCell,
  answer: string,
): ExecutionFold {
  const updated = cells.map((c) => (c.id === cell.id ? { ...cell, answer, isAnswered: true } : c));
  return {
    cells: insertOutputAfterCell(updated, cell.id, makeOutputCell(cell.id, { answer }, 0, [])),
    state: { status: "completed" },
  };
}

/** Validates and evaluates a branch, recording the matched path on the cell. */
export function evaluateBranchCell(
  cell: BranchCell,
  cells: WorkbookCell[],
  pass?: number,
): ExecutionFold {
  const configErrors = validateBranchCell(cell);
  if (configErrors.length > 0) {
    return {
      cells: insertOutputAfterCell(
        cells,
        cell.id,
        makeOutputCell(cell.id, undefined, 0, configErrors),
      ),
      state: { status: "error", error: configErrors.join("; ") },
    };
  }

  const matchedPath = evaluateBranch(cell, cells);
  const passLabel = pass != null ? ` (pass ${pass})` : "";
  const messages = matchedPath
    ? [`Matched: ${matchedPath.label || "Unnamed path"}${passLabel}`]
    : [`No path matched${passLabel}`];

  const updated = insertOutputAfterCell(
    cells,
    cell.id,
    makeOutputCell(cell.id, undefined, 0, messages),
  );
  return {
    cells: updated.map((c) =>
      c.id === cell.id ? { ...cell, evaluatedPathId: matchedPath?.id } : c,
    ),
    state: { status: "completed" },
  };
}
