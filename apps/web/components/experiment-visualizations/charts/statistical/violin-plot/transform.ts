import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";
import type { ViolinSeriesData } from "@repo/ui/components/charts/box-plot";
import type { FacetGridConfig } from "@repo/ui/components/charts/cartesian-chart";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor } from "../../colors/palettes";
import { bucketIndicesByColumn, coerceCell } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";
import { buildFacetSeries } from "../../data/facet-grouping";

export interface ViolinPlotTransformResult {
  chartSeries: ViolinSeriesData[];
  subplots: FacetGridConfig | undefined;
}

// Form persists the "no points" option as the string `"false"` (Select needs
// a non-empty key); wrapper expects boolean. Map at the seam.
function resolveViolinPoints(raw: ChartFormConfig["violinPoints"]): ViolinSeriesData["points"] {
  const value = raw ?? "outliers";
  return value === "false" ? false : value;
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

/** Pure data transform for the violin-plot chart: buckets rows per (cell/category/Y) and passes raw values to the violin trace. */
export function transformViolinPlotData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
  chartConfig: ChartFormConfig,
): ViolinPlotTransformResult {
  const yEntries = dataSourcesByRole(dataSources, "y");
  if (yEntries.length === 0) {
    return { chartSeries: [], subplots: undefined };
  }

  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const colorColumn = dataSourcesByRole(dataSources, "color")[0]?.source.columnName;
  const facetColumn = dataSourcesByRole(dataSources, "facet")[0]?.source.columnName;

  const orientation = chartConfig.violinOrientation === "h" ? "h" : "v";
  const colorMap = chartConfig.colorMap;
  const markerOpacity =
    typeof chartConfig.marker?.opacity === "number" ? chartConfig.marker.opacity : undefined;
  const points = resolveViolinPoints(chartConfig.violinPoints);
  const showBox = chartConfig.violinShowBox !== false;
  const showMeanline = Boolean(chartConfig.violinShowMeanline);
  const side = chartConfig.violinSide ?? "both";
  const scalemode = chartConfig.violinScalemode ?? "width";
  const boxColor = chartConfig.violinBoxColor;
  const markerColor = chartConfig.violinMarkerColor;

  const baseSeries = (
    yValues: number[],
    xValues: (string | number)[] | undefined,
    name: string,
    color: string | undefined,
    legendgroup: string | undefined,
    xaxisId: string | undefined,
    yaxisId: string | undefined,
    showlegend: boolean | undefined,
  ): ViolinSeriesData => ({
    y: orientation === "v" ? yValues : xValues,
    x: orientation === "v" ? xValues : yValues,
    name,
    color,
    marker: { opacity: markerOpacity, color: markerColor },
    points,
    box: boxColor
      ? { visible: showBox, fillcolor: boxColor, line: { color: boxColor, width: 1 } }
      : { visible: showBox },
    meanline: { visible: showMeanline },
    side,
    scalemode,
    orientation,
    legendgroup,
    xaxisId,
    yaxisId,
    showlegend,
  });

  return buildFacetSeries<ViolinSeriesData>(
    { rows, facetColumn, colorColumn, chartConfig },
    ({ cellRows, xaxisId, yaxisId, showlegend, globalCategoryKeys, globalCategoryValues }) => {
      // X is shared across every Y series; pre-coerce once per row
      // to save O(N * (Y-1)) coerceCell calls on multi-Y charts.
      const cellXValues: (string | number | null)[] | null = xColumn
        ? cellRows.map((row) => coerceCell(row[xColumn]))
        : null;
      const allIndices = cellRows.map((_, i) => i);

      if (!colorColumn) {
        return yEntries.map(({ source }, index): ViolinSeriesData => {
          const { yValues, xValues } = collectNumericYAndOptionalX(
            cellRows,
            allIndices,
            source.columnName,
            cellXValues,
          );
          const seriesColor = Array.isArray(chartConfig.color)
            ? chartConfig.color[index]
            : chartConfig.color;
          return baseSeries(
            yValues,
            xColumn ? xValues : undefined,
            source.alias ?? source.columnName,
            seriesColor,
            undefined,
            xaxisId,
            yaxisId,
            showlegend,
          );
        });
      }

      const cellIndicesByCategory = bucketIndicesByColumn(cellRows, colorColumn);
      return yEntries.flatMap(({ source }, yIndex) => {
        const baseName = source.alias ?? source.columnName;
        return globalCategoryValues.map((categoryValue, catIndex): ViolinSeriesData => {
          const key = globalCategoryKeys[catIndex];
          const indices = cellIndicesByCategory.get(key) ?? [];
          const categoryLabel = categoryValue == null ? "(none)" : String(categoryValue);
          const { yValues, xValues } = collectNumericYAndOptionalX(
            cellRows,
            indices,
            source.columnName,
            cellXValues,
          );
          const seriesColor = getCategoryColor(
            catIndex + yIndex * globalCategoryValues.length,
            colorMap,
            key,
            baseName,
          );
          return baseSeries(
            yValues,
            xColumn ? xValues : undefined,
            yEntries.length === 1 ? categoryLabel : `${baseName} - ${categoryLabel}`,
            seriesColor,
            yEntries.length > 1 ? baseName : undefined,
            xaxisId,
            yaxisId,
            showlegend,
          );
        });
      });
    },
  );
}
