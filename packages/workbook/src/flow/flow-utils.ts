import type { RunnerCell } from "../cells";

/** Suffix for the synthetic step that runs a macro-constructed command. */
export function dispatchStepId(macroCellId: string): string {
  return `${macroCellId}__dispatch`;
}

export const DISPATCH_STEP_SUFFIX = "__dispatch";

// Cells the runtime stops on. Output cells carry results but are never visited.
const EXECUTABLE = new Set(["protocol", "macro", "question", "markdown", "branch", "command"]);

export function isExecutable(cell: RunnerCell): boolean {
  return EXECUTABLE.has(cell.type);
}

export function executableCells(cells: RunnerCell[]): RunnerCell[] {
  return cells.filter(isExecutable);
}

export function firstExecutableCellId(cells: RunnerCell[]): string | null {
  return executableCells(cells)[0]?.id ?? null;
}

export function cellById(cells: RunnerCell[], cellId: string): RunnerCell | undefined {
  return cells.find((c) => c.id === cellId);
}

/** Next step in document order, skipping output cells; null past the end. */
export function nextCellId(cells: RunnerCell[], cellId: string): string | null {
  const order = executableCells(cells);
  const idx = order.findIndex((c) => c.id === cellId);
  if (idx < 0 || idx + 1 >= order.length) return null;
  return order[idx + 1].id;
}

/** Previous step in document order; null before the start. */
export function prevCellId(cells: RunnerCell[], cellId: string): string | null {
  const order = executableCells(cells);
  const idx = order.findIndex((c) => c.id === cellId);
  if (idx <= 0) return null;
  return order[idx - 1].id;
}

// A branch goto is only a valid jump target if it resolves to a visited step.
// Pointing at an output cell or a missing id falls through sequentially.
export function resolveGotoCellId(cells: RunnerCell[], gotoCellId: string): string | null {
  const target = cellById(cells, gotoCellId);
  return target && isExecutable(target) ? target.id : null;
}

export function cellIndex(cells: RunnerCell[], cellId: string): number {
  return cells.findIndex((c) => c.id === cellId);
}

/**
 * Nearest producer (protocol or command) before `cellId` in document order.
 * A macro runs against that step's raw output, exposed to macro code as
 * `json`; null when none precedes it.
 */
export function nearestUpstreamProducerId(cells: RunnerCell[], cellId: string): string | null {
  const idx = cellIndex(cells, cellId);
  for (let i = idx - 1; i >= 0; i--) {
    const type = cells[i].type;
    if (type === "protocol" || type === "command") return cells[i].id;
  }
  return null;
}

/** Producer cells write `outputs` and are subject to stale marking. */
export function isProducer(cell: RunnerCell): boolean {
  return cell.type === "protocol" || cell.type === "command" || cell.type === "macro";
}
