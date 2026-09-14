import { coerceCell } from "./cell-coercion";

type SortKey = string | number | null;

/**
 * Rows ordered by one column the way the warehouse orders them: nulls first,
 * then numbers, then strings by code unit. Numeric strings count as numbers,
 * matching the axes the renderers build from the same coercion. Returns a new
 * array; the rows themselves are shared and never moved.
 */
export function sortRowsByColumn(
  rows: Record<string, unknown>[],
  column: string,
): Record<string, unknown>[] {
  const keyed = rows.map((row, index) => ({ row, index, key: coerceCell(row[column]) }));
  keyed.sort((a, b) => compareKeys(a.key, b.key) || a.index - b.index);
  return keyed.map((entry) => entry.row);
}

function compareKeys(a: SortKey, b: SortKey): number {
  if (a === null) {
    return b === null ? 0 : -1;
  }
  if (b === null) {
    return 1;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  if (typeof a === "number") {
    return -1;
  }
  if (typeof b === "number") {
    return 1;
  }
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
