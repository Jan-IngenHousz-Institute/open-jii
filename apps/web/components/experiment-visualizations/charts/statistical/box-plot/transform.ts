import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";
import type { BoxSeriesData } from "@repo/ui/components/charts/box-plot";
import type { FacetGridConfig } from "@repo/ui/components/charts/cartesian-chart";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor } from "../../colors/palettes";
import { bucketIndicesByColumn, coerceCell } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";
import { buildFacetSeries } from "../../data/facet-grouping";

export interface BoxPlotTransformResult {
  chartSeries: BoxSeriesData[];
  subplots: FacetGridConfig | undefined;
}

// `boxmean` is tri-state: form stores "false" / "true" / "sd"; the wrapper
// expects `boolean | "sd"`, so map at the seam.
function resolveBoxmean(raw: ChartFormConfig["boxmean"]): BoxSeriesData["boxmean"] {
  if (raw === "sd") return "sd";
  if (raw === "true") return true;
  return false;
}

interface CollectedPoints {
  yValues: number[];
  xValues: (string | number)[];
}

// Walk `indices` of `cellRows`, collecting numeric Y values and (when X is
// active) their paired X values. Drops any row whose Y isn't numeric or
// whose X coerces to null, so the two arrays stay positionally aligned.
function collectNumericYAndOptionalX(
  cellRows: Record<string, unknown>[],
  indices: number[],
  yColumn: string,
  cellXValues: (string | number | null)[] | null,
): CollectedPoints {
  const yValues: number[] = [];
  const xValues: (string | number)[] = [];
  for (const i of indices) {
    const yCell = coerceCell(cellRows[i][yColumn]);
    if (typeof yCell !== "number") {
      continue;
    }
    if (cellXValues) {
      const xCell = cellXValues[i];
      if (xCell === null) {
        continue;
      }
      xValues.push(xCell);
    }
    yValues.push(yCell);
  }
  return { yValues, xValues };
}

/** Pure data transform for the box-plot chart: buckets rows per facet/category/Y series and emits `BoxSeriesData[]`. */
export function transformBoxPlotData(
  rows: Record<string, unknown>[],
  dataSources: ExperimentDataSourceConfig[],
  chartConfig: ChartFormConfig,
): BoxPlotTransformResult {
  const yEntries = dataSourcesByRole(dataSources, "y");
  if (yEntries.length === 0) {
    return { chartSeries: [], subplots: undefined };
  }

  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const colorColumn = dataSourcesByRole(dataSources, "color")[0]?.source.columnName;
  const facetColumn = dataSourcesByRole(dataSources, "facet")[0]?.source.columnName;

  const orientation = chartConfig.boxOrientation === "h" ? "h" : "v";
  const colorMap = chartConfig.colorMap;
  const markerOpacity =
    typeof chartConfig.marker?.opacity === "number" ? chartConfig.marker.opacity : undefined;
  const boxpoints = chartConfig.boxpoints ?? "outliers";
  const notched = Boolean(chartConfig.notched);
  const boxmean = resolveBoxmean(chartConfig.boxmean);

  return buildFacetSeries<BoxSeriesData>(
    { rows, facetColumn, colorColumn, chartConfig },
    ({ cellRows, xaxisId, yaxisId, showlegend, globalCategoryKeys, globalCategoryValues }) => {
      // X is shared across every Y series; pre-coerce once per row
      // to save O(N * (Y-1)) coerceCell calls on multi-Y charts.
      const cellXValues: (string | number | null)[] | null = xColumn
        ? cellRows.map((row) => coerceCell(row[xColumn]))
        : null;
      const allIndices = cellRows.map((_, i) => i);

      if (!colorColumn) {
        return yEntries.map(({ source }, index): BoxSeriesData => {
          const { yValues, xValues } = collectNumericYAndOptionalX(
            cellRows,
            allIndices,
            source.columnName,
            cellXValues,
          );
          const seriesColor = Array.isArray(chartConfig.color)
            ? chartConfig.color[index]
            : chartConfig.color;
          const xPayload = xColumn ? xValues : undefined;
          return {
            y: orientation === "v" ? yValues : xPayload,
            x: orientation === "v" ? xPayload : yValues,
            name: source.alias ?? source.columnName,
            color: seriesColor,
            marker: { opacity: markerOpacity },
            boxpoints,
            notched,
            boxmean,
            orientation,
            xaxisId,
            yaxisId,
            showlegend,
          };
        });
      }

      const cellIndicesByCategory = bucketIndicesByColumn(cellRows, colorColumn);
      return yEntries.flatMap(({ source }, yIndex) => {
        const baseName = source.alias ?? source.columnName;
        return globalCategoryValues.map((categoryValue, catIndex): BoxSeriesData => {
          const key = globalCategoryKeys[catIndex];
          const indices = cellIndicesByCategory.get(key) ?? [];
          const categoryLabel = categoryValue == null ? "(none)" : String(categoryValue);
          const { yValues, xValues } = collectNumericYAndOptionalX(
            cellRows,
            indices,
            source.columnName,
            cellXValues,
          );
          const xPayload = xColumn ? xValues : undefined;
          const seriesColor = getCategoryColor(
            catIndex + yIndex * globalCategoryValues.length,
            colorMap,
            key,
          );
          return {
            y: orientation === "v" ? yValues : xPayload,
            x: orientation === "v" ? xPayload : yValues,
            name: yEntries.length === 1 ? categoryLabel : `${baseName} - ${categoryLabel}`,
            color: seriesColor,
            marker: { opacity: markerOpacity },
            boxpoints,
            notched,
            boxmean,
            orientation,
            legendgroup: yEntries.length > 1 ? baseName : undefined,
            xaxisId,
            yaxisId,
            showlegend,
          };
        });
      });
    },
  );
}
