import type { CellPath } from "@repo/api/transforms/workbook-cell-tree";
import {
  findWorkbookCell,
  findWorkbookCellInBody,
  resolveCellScope,
  workbookBodyAtPath,
} from "@repo/api/transforms/workbook-cell-tree";

import type { RunnerCell } from "../cells";

/** Suffix for the synthetic step that runs a macro-constructed command. */
export function dispatchStepId(macroCellId: string): string {
  return `${macroCellId}__dispatch`;
}

export const DISPATCH_STEP_SUFFIX = "__dispatch";

// Cells the runtime stops on. Output cells carry results but are never visited.
const EXECUTABLE = new Set([
  "protocol",
  "macro",
  "question",
  "markdown",
  "branch",
  "command",
  "parallel",
]);

export function isExecutable(cell: RunnerCell): boolean {
  return EXECUTABLE.has(cell.type);
}

export function executableCells(cells: RunnerCell[], path: CellPath = []): RunnerCell[] {
  return (workbookBodyAtPath(cells, path) ?? []).filter(isExecutable);
}

export function firstExecutableCellId(cells: RunnerCell[], path: CellPath = []): string | null {
  return executableCells(cells, path)[0]?.id ?? null;
}

export function cellById(
  cells: RunnerCell[],
  cellId: string,
  path?: CellPath,
): RunnerCell | undefined {
  return path
    ? findWorkbookCellInBody(cells, { path, cellId })?.cell
    : findWorkbookCell(cells, cellId)?.cell;
}

/** Next step in document order, skipping output cells; null past the end. */
export function nextCellId(cells: RunnerCell[], cellId: string, path?: CellPath): string | null {
  const location = path
    ? findWorkbookCellInBody(cells, { path, cellId })
    : findWorkbookCell(cells, cellId);
  if (!location) return null;
  const order = location.body.filter(isExecutable);
  const idx = order.findIndex((c) => c.id === cellId);
  if (idx < 0 || idx + 1 >= order.length) return null;
  return order[idx + 1].id;
}

/** Previous step in document order; null before the start. */
export function prevCellId(cells: RunnerCell[], cellId: string, path?: CellPath): string | null {
  const location = path
    ? findWorkbookCellInBody(cells, { path, cellId })
    : findWorkbookCell(cells, cellId);
  if (!location) return null;
  const order = location.body.filter(isExecutable);
  const idx = order.findIndex((c) => c.id === cellId);
  if (idx <= 0) return null;
  return order[idx - 1].id;
}

// A branch goto is only a valid jump target if it resolves to a visited step.
// Pointing at an output cell or a missing id falls through sequentially.
export function resolveGotoCellId(
  cells: RunnerCell[],
  gotoCellId: string,
  sourceCellId?: string,
  path?: CellPath,
): string | null {
  const source = sourceCellId
    ? path
      ? findWorkbookCellInBody(cells, { path, cellId: sourceCellId })
      : findWorkbookCell(cells, sourceCellId)
    : undefined;
  const target = source
    ? findWorkbookCellInBody(cells, { path: source.path, cellId: gotoCellId })?.cell
    : cellById(cells, gotoCellId, path);
  return target && isExecutable(target) ? target.id : null;
}

export function cellIndex(cells: RunnerCell[], cellId: string, path?: CellPath): number {
  return (
    (path ? findWorkbookCellInBody(cells, { path, cellId }) : findWorkbookCell(cells, cellId))
      ?.index ?? -1
  );
}

/**
 * Nearest producer (protocol or command) before `cellId` in document order.
 * A macro runs against that step's raw output, exposed to macro code as
 * `json`; null when none precedes it.
 */
export function nearestUpstreamProducerId(cells: RunnerCell[], cellId: string): string | null {
  const location = findWorkbookCell(cells, cellId);
  if (!location) return null;
  const scope = resolveCellScope(cells, { path: location.path, cellId });
  for (let i = scope.length - 1; i >= 0; i--) {
    const cell = scope[i].cell;
    if (cell.type === "protocol" || cell.type === "command") return cell.id;
  }
  return null;
}

/** Producer cells write `outputs` and are subject to stale marking. */
export function isProducer(cell: RunnerCell): boolean {
  return (
    cell.type === "protocol" ||
    cell.type === "command" ||
    cell.type === "macro" ||
    cell.type === "parallel"
  );
}
