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
 *
 * null/undefined return as `null` (Plotly renders gaps; detectAxisType
 * skips them) — stringifying them to `"null"` / `"undefined"` would inject
 * a non-numeric string and poison axis detection for an otherwise-numeric
 * column, flipping the axis to category.
 */
export function coerceCell(value: unknown): string | number | null {
  if (value == null) return null;
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
 * UX rule: with both X and Y configured we plot points. With only Y we
 * synthesise X from row indices so users still see their column. With only
 * X (or nothing), we draw NO series — the canvas renders an empty plot
 * with just the configured axis frame, signalling "pick the other axis to
 * see data" without inventing a series the user didn't ask for.
 */
export function resolveSeries(
  yEntries: IndexedDataSource[],
  xColumn: string | undefined,
): { effectiveYEntries: IndexedDataSource[]; useIndexForX: boolean } {
  return {
    effectiveYEntries: yEntries,
    useIndexForX: yEntries.length > 0 && !xColumn,
  };
}

/**
 * Build the X-axis values for a series given the resolved fallback strategy.
 */
export function buildXValues(
  rows: Record<string, unknown>[],
  xColumn: string | undefined,
  useIndexForX: boolean,
): (string | number | null)[] {
  if (useIndexForX || !xColumn) return rows.map((_row, i) => i);
  return rows.map((row) => coerceCell(row[xColumn]));
}
