import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import type { ContourSeriesData } from "@repo/ui/components/charts/contour";

import type { ChartFormConfig } from "../../chart-config";
import { resolveColorscale } from "../../colors/colorscales";
import { rowKeyForSource } from "../../data/aggregation";
import { dataSourcesByRole } from "../../data/data-sources";
import { pivotToMatrix } from "../../data/pivot-to-matrix";

/**
 * Reasons the contour renders empty with a specific user-facing message.
 * Without these guards, contour either renders invisibly or hits Plotly's
 * `makeCrossings` crash on degenerate pathinfo.
 */
export type ContourDegenerateReason = "sameColumnAxes" | "singleAxisValue" | "flatZ" | "sparseGrid";

export interface ContourTransformResult {
  series: ContourSeriesData[];
  degenerateReason: ContourDegenerateReason | null;
}

/**
 * Pure data transform for the contour chart type. Same pivot + degenerate-
 * input checks as heatmap; emits a `ContourSeriesData` with the contour
 * line/coloring options the form supplies.
 */
export function transformContourData(
  rows: Record<string, unknown>[],
  dataSources: ExperimentDataSourceConfig[],
  chartConfig: ChartFormConfig,
): ContourTransformResult {
  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const yColumn = dataSourcesByRole(dataSources, "y")[0]?.source.columnName;
  const zEntry = dataSourcesByRole(dataSources, "z").at(0);
  if (!zEntry || !xColumn || !yColumn) {
    return { series: [], degenerateReason: null };
  }
  const zColumn = zEntry.source.columnName;
  if (!zColumn) {
    return { series: [], degenerateReason: null };
  }

  if (xColumn === yColumn) {
    return { series: [], degenerateReason: "sameColumnAxes" };
  }

  const zRowKey = rowKeyForSource(zEntry.source, zEntry.index);

  const { xCategories, yCategories, z } = pivotToMatrix(rows, xColumn, yColumn, zRowKey);

  if (xCategories.length === 0 || yCategories.length === 0) {
    return { series: [], degenerateReason: null };
  }
  if (xCategories.length < 2 || yCategories.length < 2) {
    return { series: [], degenerateReason: "singleAxisValue" };
  }

  // Single pass: count finite cells, detect distinct values.
  let firstFinite: number | null = null;
  let zHasDistinct = false;
  let filledCells = 0;
  for (const row of z) {
    for (const v of row) {
      if (!Number.isFinite(v)) {
        continue;
      }
      filledCells += 1;
      if (firstFinite === null) {
        firstFinite = v;
      } else if (v !== firstFinite) zHasDistinct = true;
    }
  }
  if (!zHasDistinct) {
    return { series: [], degenerateReason: "flatZ" };
  }

  // Same 10% density threshold as heatmap.
  const totalCells = xCategories.length * yCategories.length;
  if (filledCells / totalCells < 0.1) {
    return { series: [], degenerateReason: "sparseGrid" };
  }

  const coloring = chartConfig.contourColoring ?? "fill";
  const showLines = chartConfig.contourShowLines !== false;
  const showLabels = Boolean(chartConfig.contourShowLabels);
  const ncontours = chartConfig.contourNcontours;

  return {
    series: [
      {
        x: xCategories,
        y: yCategories,
        z,
        // 0 = auto: pass undefined so Plotly's `autocontour: true` path
        // picks a sensible level count instead of 0 (which would collapse
        // to "no iso-lines").
        ncontours: ncontours && ncontours > 0 ? ncontours : undefined,
        autocontour: !ncontours || ncontours <= 0,
        contours: {
          coloring,
          showlines: showLines,
          showlabels: showLabels,
        },
        line: {
          width: chartConfig.contourLineWidth ?? 1,
          smoothing: chartConfig.contourSmoothing ?? 1,
        },
        colorscale: resolveColorscale(chartConfig.contourColorscale ?? "Viridis"),
        reversescale: Boolean(chartConfig.contourReverseScale),
        showscale: chartConfig.contourShowColorbar !== false,
        colorbar:
          chartConfig.contourColorbarTitle && chartConfig.contourColorbarTitle.length > 0
            ? { title: { text: chartConfig.contourColorbarTitle, side: "right" } }
            : undefined,
      },
    ],
    degenerateReason: null,
  };
}
