import type { Role } from "@repo/api/schemas/experiment.schema";

import type { IndexedDataSource } from "./form-values";

/**
 * Coerce a row cell to a Plotly-friendly scalar.
 *
 * Plotly auto-detects axis type from the values it receives: an array of
 * numbers gets a linear scale; an array of strings becomes a category
 * axis. Many of our STRING columns store numbers as text (e.g.
 * `soil_moisture: "5.3"`) — passing those through as strings would force a
 * category axis with sorting and tick spacing that don't make sense for
 * numeric data. So we parse strings that look like finite numbers and
 * return the parsed value. Heterogeneous columns (some numeric strings,
 * some genuine labels) end up with a mix of numbers and strings, which
 * Plotly treats as categorical — the right call when a column isn't
 * uniformly numeric.
 */
export function coerceCell(value: unknown): string | number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return value;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
    return value;
  }
  return String(value);
}

/**
 * Compute the Y entries a chart should draw plus whether to synthesize the X
 * axis from row indices.
 *
 * UX rule: a chart should render with even one column picked. If only Y is
 * configured, fall back to row index for X. If only X is configured, treat
 * X as the single Y series (so the user sees their data immediately) and
 * still synthesize an index-based X axis. Both branches keep the chart
 * useful while the user finishes the data config.
 */
export function resolveSeries(
  yEntries: IndexedDataSource[],
  xColumn: string | undefined,
): { effectiveYEntries: IndexedDataSource[]; useIndexForX: boolean } {
  if (yEntries.length > 0) {
    return { effectiveYEntries: yEntries, useIndexForX: !xColumn };
  }
  if (xColumn) {
    const fallback: IndexedDataSource = {
      source: { tableName: "", columnName: xColumn, alias: xColumn, role: "y" satisfies Role },
      index: 0,
    };
    return { effectiveYEntries: [fallback], useIndexForX: true };
  }
  return { effectiveYEntries: [], useIndexForX: false };
}

/**
 * Build the X-axis values for a series given the resolved fallback strategy.
 */
export function buildXValues(
  rows: Record<string, unknown>[],
  xColumn: string | undefined,
  useIndexForX: boolean,
): (string | number)[] {
  if (useIndexForX || !xColumn) return rows.map((_row, i) => i);
  return rows.map((row) => coerceCell(row[xColumn]));
}
