import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";
import type { HeatmapSeriesData } from "@repo/ui/components/charts/heatmap";

import type { ChartFormConfig } from "../../chart-config";
import { resolveColorscale } from "../../colors/colorscales";
import { rowKeyForSource } from "../../data/aggregation";
import { dataSourcesByRole } from "../../data/data-sources";
import { pivotToMatrix } from "../../data/pivot-to-matrix";

/**
 * Reasons the heatmap renders empty with a specific user-facing message
 * instead of the generic "no data" empty-state. The renderer maps each
 * to a translated explanation telling the user what's wrong with their
 * column picks.
 */
export type HeatmapDegenerateReason = "sameColumnAxes" | "singleAxisValue" | "flatZ" | "sparseGrid";

export interface HeatmapTransformResult {
  series: HeatmapSeriesData[];
  degenerateReason: HeatmapDegenerateReason | null;
}

/**
 * Pure data transform for the heatmap chart type. Pivots `(x, y, z)` rows
 * into the matrix shape Plotly's heatmap trace expects, then runs four
 * degenerate-input checks (`sameColumnAxes`, `singleAxisValue`, `flatZ`,
 * `sparseGrid`) so the renderer can show targeted error copy instead of
 * a confusing empty plot.
 */
export function transformHeatmapData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
  chartConfig: ChartFormConfig,
): HeatmapTransformResult {
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

  // Server-side aggregation: the SQL builder produces `<col>_<fn>_s<i>`
  // for each per-source aggregate (`aggregateAliasForSource`); read via
  // the same key. When no aggregate is set (raw rows), this collapses
  // to the column name.
  const zRowKey = rowKeyForSource(zEntry.source, zEntry.index);

  const { xCategories, yCategories, z } = pivotToMatrix(rows, xColumn, yColumn, zRowKey);

  if (xCategories.length === 0 || yCategories.length === 0) {
    return { series: [], degenerateReason: null };
  }

  if (xCategories.length < 2 || yCategories.length < 2) {
    return { series: [], degenerateReason: "singleAxisValue" };
  }

  // Single pass: count finite cells, detect distinct values for the
  // flat-Z check.
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

  // Sparse-grid threshold. 10% density was picked as the "below this and
  // the chart visually disappears against continuous axes" line: a
  // typical raw-rows pivot with continuous X and Y produces N rows in an
  // N x N grid (~1/N density), which is below 10% past N=10. Categorical
  // data (devices x hours) sits well above this.
  const totalCells = xCategories.length * yCategories.length;
  if (filledCells / totalCells < 0.1) {
    return { series: [], degenerateReason: "sparseGrid" };
  }

  // Plotly accepts `"false"` as a string disable on the form (matches its
  // own union including `false`); collapse "false" → false here.
  const zsmoothRaw = chartConfig.heatmapZsmooth;
  const zsmooth: false | "best" | "fast" =
    zsmoothRaw === "best" || zsmoothRaw === "fast" ? zsmoothRaw : false;

  const decimals = Math.max(0, Math.floor(chartConfig.heatmapTextDecimals ?? 2));
  const showText = Boolean(chartConfig.heatmapShowText);
  const text = showText
    ? z.map((rowVals) => rowVals.map((v) => (Number.isFinite(v) ? v.toFixed(decimals) : "")))
    : undefined;

  return {
    series: [
      {
        x: xCategories,
        y: yCategories,
        z,
        colorscale: resolveColorscale(chartConfig.heatmapColorscale ?? "Viridis"),
        reversescale: Boolean(chartConfig.heatmapReverseScale),
        showscale: chartConfig.heatmapShowColorbar !== false,
        zsmooth,
        text,
        texttemplate: showText ? "%{text}" : undefined,
        colorbar:
          chartConfig.heatmapColorbarTitle && chartConfig.heatmapColorbarTitle.length > 0
            ? { title: { text: chartConfig.heatmapColorbarTitle, side: "right" } }
            : undefined,
      },
    ],
    degenerateReason: null,
  };
}
