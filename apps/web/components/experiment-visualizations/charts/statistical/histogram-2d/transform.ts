import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";
import type { Histogram2DSeriesData } from "@repo/ui/components/charts/histogram";

import type { ChartFormConfig } from "../../chart-config";
import { resolveColorscale } from "../../colors/colorscales";
import { coerceCell } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";

/**
 * Treat 0 (the slider's "auto" floor) as undefined so Plotly's auto-bin
 * path takes over. Negative values from a wonky form state also collapse
 * to auto rather than getting passed straight through.
 */
export function positiveOrAuto(n: number | undefined): number | undefined {
  return typeof n === "number" && n > 0 ? n : undefined;
}

/** Pure data transform for the 2D histogram: extracts paired numeric (x, y) tuples and drops rows where either fails to coerce. */
export function transformHistogram2DData(
  rows: Record<string, unknown>[],
  dataSources: ExperimentDataSourceConfig[],
  chartConfig: ChartFormConfig,
): Histogram2DSeriesData[] {
  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const yColumn = dataSourcesByRole(dataSources, "y")[0]?.source.columnName;
  if (!xColumn || !yColumn) {
    return [];
  }

  const xVals: (string | number)[] = [];
  const yVals: number[] = [];
  for (const row of rows) {
    const xCell = coerceCell(row[xColumn]);
    const yCell = coerceCell(row[yColumn]);
    if (typeof xCell !== "number" || typeof yCell !== "number") {
      continue;
    }
    xVals.push(xCell);
    yVals.push(yCell);
  }

  if (xVals.length === 0) {
    return [];
  }

  return [
    {
      x: xVals,
      y: yVals,
      // Form persists 0 as "auto" (so the slider's floor is meaningful);
      // map back to undefined here so Plotly's auto-bin path takes over.
      nbinsx: positiveOrAuto(chartConfig.hist2dNbinsX),
      nbinsy: positiveOrAuto(chartConfig.hist2dNbinsY),
      histnorm: chartConfig.hist2dHistnorm,
      colorscale: resolveColorscale(chartConfig.hist2dColorscale ?? "Viridis"),
      reversescale: Boolean(chartConfig.hist2dReverseScale),
      showscale: chartConfig.hist2dShowColorbar !== false,
      // Plotly 3.x: colorbar title is a nested `{ text, side }` object.
      // Passing `title: string, titleside: "right"` silently no-ops.
      colorbar:
        chartConfig.hist2dColorbarTitle && chartConfig.hist2dColorbarTitle.length > 0
          ? { title: { text: chartConfig.hist2dColorbarTitle, side: "right" } }
          : undefined,
    },
  ];
}
