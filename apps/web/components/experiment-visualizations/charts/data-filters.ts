/**
 * Client-side row filter primitives shared by every chart renderer. The
 * bar chart shipped the first filter UI (Select+Select rows over an
 * `equals` operator) and other chart types now reuse the same shape — so
 * the evaluator lives here instead of in any single chart's helpers.
 *
 * The schema-side filter shape under `dataConfig.filters` allows several
 * operators (equals, not_equals, greater_than, etc.) but for now the
 * renderer only honours `equals` — the broader operator set lands once
 * the chip-bar UI lands on this branch.
 */

export interface RowFilter {
  /** Column name to filter on. */
  column: string;
  /**
   * Operator. Only `equals` is honoured today — other operators in the
   * schema are reserved for the upcoming chip-bar filter UI.
   */
  operator: string;
  /** Comparison value. Stringified at compare time. */
  value: unknown;
}

/**
 * Apply the configured row filters (AND-combined) before chart-specific
 * series construction or aggregation. Filters with empty column / value
 * are treated as not-configured and skipped — that way a half-edited
 * filter row in the UI doesn't make the chart go empty mid-typing.
 */
export function applyRowFilters(
  rows: Record<string, unknown>[],
  filters: RowFilter[] | undefined,
): Record<string, unknown>[] {
  if (!filters || filters.length === 0) return rows;
  const active = filters.filter(
    (f) =>
      f.operator === "equals" &&
      f.column &&
      f.value !== undefined &&
      f.value !== null &&
      f.value !== "",
  );
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every((f) => {
      const cellStr = stringifyForCompare(row[f.column]);
      const valStr = stringifyForCompare(f.value);
      // Reject when either side stringified to null — that's our signal
      // that the cell was an object / array / null / undefined, and a
      // null === null match would let two unrelated cells appear equal.
      return cellStr !== null && valStr !== null && cellStr === valStr;
    }),
  );
}

function stringifyForCompare(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  // Objects / arrays would collapse to "[object Object]"; treat them as a
  // mismatch by returning null so two unrelated cells don't compare equal.
  return null;
}
