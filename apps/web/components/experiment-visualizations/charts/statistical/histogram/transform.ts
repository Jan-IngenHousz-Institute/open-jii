import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";
import type { FacetGridConfig } from "@repo/ui/components/charts/cartesian-chart";
import type { HistogramSeriesData } from "@repo/ui/components/charts/histogram";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor } from "../../colors/palettes";
import { bucketIndicesByColumn, coerceCell } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";
import { buildFacetSeries } from "../../data/facet-grouping";

export interface HistogramTransformResult {
  chartSeries: HistogramSeriesData[];
  subplots: FacetGridConfig | undefined;
}

/** Pure data transform for the histogram chart: emits one `HistogramSeriesData` per Y series, optionally split by colour and faceted by cell. */
export function transformHistogramData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
  chartConfig: ChartFormConfig,
): HistogramTransformResult {
  const yEntries = dataSourcesByRole(dataSources, "y");
  if (yEntries.length === 0) {
    return { chartSeries: [], subplots: undefined };
  }

  const colorColumn = dataSourcesByRole(dataSources, "color")[0]?.source.columnName;
  const facetColumn = dataSourcesByRole(dataSources, "facet")[0]?.source.columnName;

  const orientation = chartConfig.histogramOrientation === "h" ? "h" : "v";
  const colorMap = chartConfig.colorMap;
  const markerOpacity =
    typeof chartConfig.marker?.opacity === "number" ? chartConfig.marker.opacity : undefined;

  const facetResult = buildFacetSeries<HistogramSeriesData>(
    { rows, facetColumn, colorColumn, chartConfig },
    ({ cellRows, xaxisId, yaxisId, showlegend, globalCategoryKeys, globalCategoryValues }) => {
      // No color split: one trace per Y series.
      if (!colorColumn) {
        return yEntries.map(({ source }, index): HistogramSeriesData => {
          const values = cellRows
            .map((row) => coerceCell(row[source.columnName]))
            .filter((v): v is string | number => v !== null);
          const seriesColor = Array.isArray(chartConfig.color)
            ? chartConfig.color[index]
            : chartConfig.color;
          return {
            x: orientation === "v" ? values : undefined,
            y: orientation === "h" ? values : undefined,
            name: source.alias ?? source.columnName,
            marker: { color: seriesColor, opacity: markerOpacity },
            xaxisId,
            yaxisId,
            showlegend,
          };
        });
      }

      // Color split: one trace per (Y x category) per cell.
      const cellIndicesByCategory = bucketIndicesByColumn(cellRows, colorColumn);

      return yEntries.flatMap(({ source }, yIndex) => {
        const baseName = source.alias ?? source.columnName;
        return globalCategoryValues.map((categoryValue, catIndex): HistogramSeriesData => {
          const key = globalCategoryKeys[catIndex];
          const indices = cellIndicesByCategory.get(key) ?? [];
          const categoryLabel = categoryValue == null ? "(none)" : String(categoryValue);
          const values = indices
            .map((i) => coerceCell(cellRows[i][source.columnName]))
            .filter((v): v is string | number => v !== null);
          const seriesColor = getCategoryColor(
            catIndex + yIndex * globalCategoryValues.length,
            colorMap,
            key,
            baseName,
          );
          return {
            x: orientation === "v" ? values : undefined,
            y: orientation === "h" ? values : undefined,
            name: yEntries.length === 1 ? categoryLabel : `${baseName} - ${categoryLabel}`,
            marker: { color: seriesColor, opacity: markerOpacity },
            legendgroup: yEntries.length > 1 ? baseName : undefined,
            xaxisId,
            yaxisId,
            showlegend,
          };
        });
      });
    },
  );

  const enriched: HistogramSeriesData[] = facetResult.chartSeries.map((s) => ({
    ...s,
    nbinsx: orientation === "v" ? chartConfig.nbinsx : undefined,
    nbinsy: orientation === "h" ? chartConfig.nbinsx : undefined,
    histnorm: chartConfig.histnorm,
    cumulative: chartConfig.cumulative ? { enabled: true } : undefined,
    orientation,
    // Share bin edges across colors in the same cell; scope by cell so
    // per-facet ranges still adapt to local data.
    bingroup: s.xaxisId ? `cell:${s.xaxisId}` : "default",
  }));

  return { chartSeries: enriched, subplots: facetResult.subplots };
}
