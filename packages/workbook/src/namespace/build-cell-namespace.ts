import { sanitizeQuestionLabel } from "@repo/api/schemas/experiment.schema";

import type { RunnerCell } from "../cells";

export interface CellNamespace {
  // Producer output (or `{ answer }` for a question) keyed by stable cell id.
  // Populated for every upstream cell that has produced a value.
  byId: Record<string, unknown>;
  // The same values keyed by canonicalised author-facing name, for `ctx.<name>`
  // access from macro code and for resolving branch sources by name.
  ctx: Record<string, unknown>;
  // Canonical name to cell id, for diagnostics and name-to-id resolution.
  names: Record<string, string>;
}

// Local port of @repo/api's namespaceNameOf, which main does not export yet.
function namespaceNameOf(cell: RunnerCell): string | undefined {
  switch (cell.type) {
    case "question":
      return cell.name;
    case "protocol":
    case "macro":
    case "command":
      return cell.payload.name;
    default:
      return undefined;
  }
}

// Reads the output a producer cell emitted, unwrapping a non-empty array to its
// first element to match the macro sandbox's `unwrapMeasurement`. Returns
// undefined when the cell has not produced an output yet.
export function resolveOutputData(
  cells: RunnerCell[],
  producedBy: string,
): Record<string, unknown> | undefined {
  const outputCell = cells.find((c) => c.type === "output" && c.producedBy === producedBy);
  if (outputCell?.type !== "output" || outputCell.data == null) return undefined;
  const data = outputCell.data as Record<string, unknown> | unknown[];
  if (Array.isArray(data)) {
    return (data[0] as Record<string, unknown> | undefined) ?? undefined;
  }
  return data;
}

// The value a cell contributes to the namespace: `{ answer }` for an answered
// question, the unwrapped output for a protocol/macro/command, or undefined for
// other cell types and for producers that have not run yet.
function cellValue(cells: RunnerCell[], cell: RunnerCell): unknown {
  if (cell.type === "question") {
    return cell.answer != null ? { answer: cell.answer } : undefined;
  }
  if (cell.type === "protocol" || cell.type === "macro" || cell.type === "command") {
    return resolveOutputData(cells, cell.id);
  }
  return undefined;
}

// The namespace a macro at `beforeIndex` can read: every upstream output,
// addressable by id (`byId`) and canonical name (`ctx`). Only cells strictly
// before `beforeIndex` are visible, so a macro never reads its own or a later
// cell's output.
export function buildCellNamespace(
  cells: RunnerCell[],
  beforeIndex: number = cells.length,
): CellNamespace {
  const byId: Record<string, unknown> = {};
  const ctx: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  const limit = Math.max(0, Math.min(beforeIndex, cells.length));
  for (let i = 0; i < limit; i++) {
    const cell = cells[i];
    const value = cellValue(cells, cell);
    if (value === undefined) continue;

    byId[cell.id] = value;
    const name = namespaceNameOf(cell);
    if (name != null && name !== "") {
      const canonical = sanitizeQuestionLabel(name);
      ctx[canonical] = value;
      names[canonical] = cell.id;
    }
  }

  return { ctx, byId, names };
}
