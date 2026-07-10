import { coerceCell } from "./cell-coercion";

/**
 * Reshape pre-aggregated `(x, y, z)` rows into the `(xCategories,
 * yCategories, z[][])` triple Plotly's `heatmap` and `contour` traces
 * expect. Plotly's z layout is `z[yIndex][xIndex]`.
 *
 * Numeric axes are sorted ascending so the grid is monotonic regardless of
 * row order (an unsorted numeric axis makes `contour` draw scrambled iso-
 * lines). Genuine string-category axes keep first-seen order.
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

/** Sort a fully-numeric axis ascending; leave categorical axes first-seen. */
function orderCategories(categories: (string | number)[]): (string | number)[] {
  const allNumeric = categories.every((c) => typeof c === "number");
  if (!allNumeric) {
    return categories;
  }
  return [...categories].sort((a, b) => Number(a) - Number(b));
}
