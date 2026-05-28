import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";
import type { FacetGridConfig } from "@repo/ui/components/charts/cartesian-chart";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor, withAlpha } from "../../colors/palettes";
import { bucketIndicesByColumn, coerceCell } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";
import { buildFacetSeries } from "../../data/facet-grouping";
import { computeKDE } from "../../data/kde";

export interface DensityPlotTransformResult {
  chartSeries: LineSeriesData[];
  subplots: FacetGridConfig | undefined;
}

/** Pure data transform for the density-plot chart: computes per-(cell/category/Y) KDE curves via `computeKDE`. */
export function transformDensityPlotData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
  chartConfig: ChartFormConfig,
): DensityPlotTransformResult {
  const yEntries = dataSourcesByRole(dataSources, "y");
  if (yEntries.length === 0) {
    return { chartSeries: [], subplots: undefined };
  }

  const colorColumn = dataSourcesByRole(dataSources, "color")[0]?.source.columnName;
  const facetColumn = dataSourcesByRole(dataSources, "facet")[0]?.source.columnName;

  const orientation = chartConfig.densityOrientation === "h" ? "h" : "v";
  const cumulative = Boolean(chartConfig.densityCumulative);
  const fill = Boolean(chartConfig.densityFill);
  const lineWidth = chartConfig.densityLineWidth ?? 2;
  const markerOpacity =
    typeof chartConfig.marker?.opacity === "number" ? chartConfig.marker.opacity : 0.7;
  const colorMap = chartConfig.colorMap;

  const buildSeries = (
    values: number[],
    name: string,
    color: string | undefined,
    legendgroup: string | undefined,
    xaxisId: string | undefined,
    yaxisId: string | undefined,
    showlegend: boolean | undefined,
  ): LineSeriesData | null => {
    if (values.length < 2) {
      return null;
    }
    const { xs, ys } = computeKDE(values, cumulative);
    const fillKey = orientation === "v" ? "tozeroy" : "tozerox";
    return {
      x: orientation === "v" ? xs : ys,
      y: orientation === "v" ? ys : xs,
      name,
      mode: "lines",
      line: { color, width: lineWidth },
      fill: fill ? fillKey : "none",
      fillcolor: fill ? withAlpha(color, markerOpacity) : undefined,
      legendgroup,
      xaxisId,
      yaxisId,
      showlegend,
    };
  };

  return buildFacetSeries<LineSeriesData>(
    { rows, facetColumn, colorColumn, chartConfig },
    ({ cellRows, xaxisId, yaxisId, showlegend, globalCategoryKeys, globalCategoryValues }) => {
      if (!colorColumn) {
        return yEntries
          .map(({ source }, index): LineSeriesData | null => {
            const values = cellRows
              .map((row) => coerceCell(row[source.columnName]))
              .filter((v): v is number => typeof v === "number");
            const seriesColor = Array.isArray(chartConfig.color)
              ? chartConfig.color[index]
              : chartConfig.color;
            return buildSeries(
              values,
              source.alias ?? source.columnName,
              seriesColor,
              undefined,
              xaxisId,
              yaxisId,
              showlegend,
            );
          })
          .filter((s): s is LineSeriesData => s !== null);
      }

      const cellIndicesByCategory = bucketIndicesByColumn(cellRows, colorColumn);

      return yEntries
        .flatMap(({ source }, yIndex) => {
          const baseName = source.alias ?? source.columnName;
          return globalCategoryValues.map((categoryValue, catIndex): LineSeriesData | null => {
            const key = globalCategoryKeys[catIndex];
            const indices = cellIndicesByCategory.get(key) ?? [];
            const categoryLabel = categoryValue == null ? "(none)" : String(categoryValue);
            const values = indices
              .map((i) => coerceCell(cellRows[i][source.columnName]))
              .filter((v): v is number => typeof v === "number");
            const seriesColor = getCategoryColor(
              catIndex + yIndex * globalCategoryValues.length,
              colorMap,
              key,
            );
            return buildSeries(
              values,
              yEntries.length === 1 ? categoryLabel : `${baseName} - ${categoryLabel}`,
              seriesColor,
              yEntries.length > 1 ? baseName : undefined,
              xaxisId,
              yaxisId,
              showlegend,
            );
          });
        })
        .filter((s): s is LineSeriesData => s !== null);
    },
  );
}
