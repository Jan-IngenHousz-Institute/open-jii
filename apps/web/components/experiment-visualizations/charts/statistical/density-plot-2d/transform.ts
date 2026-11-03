import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { continuousPairs } from "../../data/continuous-pairs";
import { dataSourcesByRole } from "../../data/data-sources";

export interface DensityPlot2DTransformResult {
  x: (string | number)[];
  y: (string | number)[];
  hasColumns: boolean;
}

/** Pure data transform for the 2D density plot: extracts paired numeric or timestamp cells. */
export function transformDensityPlot2DData(
  rows: Record<string, unknown>[],
  dataSources: ExperimentDataSourceConfig[],
): DensityPlot2DTransformResult {
  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const yColumn = dataSourcesByRole(dataSources, "y")[0]?.source.columnName;
  if (!xColumn || !yColumn) {
    return { x: [], y: [], hasColumns: false };
  }

  return { ...continuousPairs(rows, xColumn, yColumn), hasColumns: true };
}
