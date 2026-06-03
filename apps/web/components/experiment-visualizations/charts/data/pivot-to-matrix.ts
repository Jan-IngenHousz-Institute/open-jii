import { coerceCell } from "./cell-coercion";

/**
 * Reshape pre-aggregated `(x, y, z)` rows into the `(xCategories,
 * yCategories, z[][])` triple Plotly's `heatmap` and `contour` traces
 * expect. Categories preserve first-seen order. Plotly's z layout is
 * `z[yIndex][xIndex]`.
 */
export function pivotToMatrix(
  rows: Record<string, unknown>[],
  xColumn: string,
  yColumn: string,
  zRowKey: string,
): { xCategories: (string | number)[]; yCategories: (string | number)[]; z: number[][] } {
  // Single pass over rows: lazily assign x/y indices on first sight,
  // record (xi, yi, z) in a flat list. Materialise the dense matrix
  // once at the end when the final category counts are known.
  const xIndex = new Map<string | number, number>();
  const yIndex = new Map<string | number, number>();
  const xCategories: (string | number)[] = [];
  const yCategories: (string | number)[] = [];
  const cells: { xi: number; yi: number; z: number }[] = [];

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

    let xi = xIndex.get(xCell);
    if (xi === undefined) {
      xi = xCategories.length;
      xIndex.set(xCell, xi);
      xCategories.push(xCell);
    }
    let yi = yIndex.get(yCell);
    if (yi === undefined) {
      yi = yCategories.length;
      yIndex.set(yCell, yi);
      yCategories.push(yCell);
    }
    cells.push({ xi, yi, z: zCell });
  }

  const z: number[][] = new Array<number[]>(yCategories.length);
  for (let i = 0; i < yCategories.length; i++) {
    z[i] = new Array<number>(xCategories.length).fill(NaN);
  }
  // Later cells with the same (xi, yi) overwrite earlier ones.
  for (const { xi, yi, z: value } of cells) {
    z[yi][xi] = value;
  }

  return { xCategories, yCategories, z };
}
