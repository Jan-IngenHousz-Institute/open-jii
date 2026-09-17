import { coerceCell } from "./cell-coercion";

/**
 * Reshape pre-aggregated `(x, y, z)` rows into the `(xCategories,
 * yCategories, z[][])` triple Plotly's `heatmap` and `contour` traces
 * expect. Plotly's z layout is `z[yIndex][xIndex]`.
 *
 * Numeric axes are sorted ascending so the grid is monotonic regardless of
 * row order (an unsorted numeric axis makes `contour` draw scrambled iso-
 * lines). Temporal axes are sorted chronologically for the same reason:
 * bucketed timestamps arrive as ISO strings in whatever order the GROUP BY
 * produced them, and the chart-data path sends no ORDER BY. Genuine
 * string-category axes keep first-seen order.
 */
export function pivotToMatrix(
  rows: Record<string, unknown>[],
  xColumn: string,
  yColumn: string,
  zRowKey: string,
): { xCategories: (string | number)[]; yCategories: (string | number)[]; z: number[][] } {
  const xSeen = new Set<string | number>();
  const ySeen = new Set<string | number>();
  const xCategoriesRaw: (string | number)[] = [];
  const yCategoriesRaw: (string | number)[] = [];
  const cells: { x: string | number; y: string | number; z: number }[] = [];

  for (const row of rows) {
    const xCell = coerceCell(row[xColumn]);
    const yCell = coerceCell(row[yColumn]);
    const zCell = coerceCell(row[zRowKey]);
    if (xCell === null || yCell === null) {
      continue;
    }
    if (typeof zCell !== "number") {
      continue;
    }

    if (!xSeen.has(xCell)) {
      xSeen.add(xCell);
      xCategoriesRaw.push(xCell);
    }
    if (!ySeen.has(yCell)) {
      ySeen.add(yCell);
      yCategoriesRaw.push(yCell);
    }
    cells.push({ x: xCell, y: yCell, z: zCell });
  }

  const xCategories = orderCategories(xCategoriesRaw);
  const yCategories = orderCategories(yCategoriesRaw);
  const xIndex = new Map<string | number, number>(xCategories.map((v, i) => [v, i]));
  const yIndex = new Map<string | number, number>(yCategories.map((v, i) => [v, i]));

  const z: number[][] = new Array<number[]>(yCategories.length);
  for (let i = 0; i < yCategories.length; i++) {
    z[i] = new Array<number>(xCategories.length).fill(NaN);
  }
  // Later cells with the same (x, y) overwrite earlier ones.
  for (const { x, y, z: value } of cells) {
    const xi = xIndex.get(x);
    const yi = yIndex.get(y);
    if (xi === undefined || yi === undefined) {
      continue;
    }
    z[yi][xi] = value;
  }

  return { xCategories, yCategories, z };
}

// Matches the ISO-8601 shapes Databricks emits for TIMESTAMP cells
// (`2026-09-14T08:00:00.000Z`, with or without fraction / offset) and the
// space-separated form `date_trunc` buckets can take. Anchored so that a
// device name or a numeric-looking code never qualifies.
const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Sort a fully-numeric axis ascending and a fully-temporal axis
 * chronologically; leave categorical axes first-seen.
 */
function orderCategories(categories: (string | number)[]): (string | number)[] {
  if (categories.every((c) => typeof c === "number")) {
    return [...categories].sort((a, b) => Number(a) - Number(b));
  }
  const epochs = new Map<string | number, number>();
  for (const c of categories) {
    if (typeof c !== "string" || !ISO_TIMESTAMP.test(c)) {
      return categories;
    }
    const epoch = Date.parse(c);
    if (!Number.isFinite(epoch)) {
      return categories;
    }
    epochs.set(c, epoch);
  }
  return [...categories].sort((a, b) => (epochs.get(a) ?? 0) - (epochs.get(b) ?? 0));
}
