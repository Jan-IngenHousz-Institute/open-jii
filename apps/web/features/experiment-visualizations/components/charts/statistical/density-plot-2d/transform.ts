import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";

import { coerceCell } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";

export interface DensityPlot2DTransformResult {
  x: number[];
  y: number[];
  hasColumns: boolean;
}

/** Pure data transform for the 2D density plot: extracts paired (x, y) numeric tuples and drops rows where either fails to coerce. */
export function transformDensityPlot2DData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
): DensityPlot2DTransformResult {
  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const yColumn = dataSourcesByRole(dataSources, "y")[0]?.source.columnName;
  if (!xColumn || !yColumn) {
    return { x: [], y: [], hasColumns: false };
  }

  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of rows) {
    const xCell = coerceCell(row[xColumn]);
    const yCell = coerceCell(row[yColumn]);
    if (typeof xCell !== "number" || typeof yCell !== "number") {
      continue;
    }
    xs.push(xCell);
    ys.push(yCell);
  }
  return { x: xs, y: ys, hasColumns: true };
}
