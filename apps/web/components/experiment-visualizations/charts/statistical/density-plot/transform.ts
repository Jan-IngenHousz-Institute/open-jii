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
    fixedRange: [number, number] | undefined,
  ): LineSeriesData | null => {
    if (values.length < 2) {
      return null;
    }
    const { xs, ys } = computeKDE(values, cumulative, fixedRange);
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

  // Shared x-grid for cumulative curves; otherwise each CDF stops at its
  // own max and Plotly's fill drops a vertical wall back to the baseline.
  const unionRangeOf = (allValues: number[][]): [number, number] | undefined => {
    if (!cumulative) return undefined;
    const flat = allValues.flat();
    if (flat.length < 2) return undefined;
    return [Math.min(...flat), Math.max(...flat)];
  };

  return buildFacetSeries<LineSeriesData>(
    { rows, facetColumn, colorColumn, chartConfig },
    ({ cellRows, xaxisId, yaxisId, showlegend, globalCategoryKeys, globalCategoryValues }) => {
      if (!colorColumn) {
        const perSeriesValues = yEntries.map(({ source }) =>
          cellRows
            .map((row) => coerceCell(row[source.columnName]))
            .filter((v): v is number => typeof v === "number"),
        );
        const fixedRange = unionRangeOf(perSeriesValues);
        return yEntries
          .map(({ source }, index): LineSeriesData | null => {
            const seriesColor = Array.isArray(chartConfig.color)
              ? chartConfig.color[index]
              : chartConfig.color;
            return buildSeries(
              perSeriesValues[index] ?? [],
              source.alias ?? source.columnName,
              seriesColor,
              undefined,
              xaxisId,
              yaxisId,
              showlegend,
              fixedRange,
            );
          })
          .filter((s): s is LineSeriesData => s !== null);
      }

      const cellIndicesByCategory = bucketIndicesByColumn(cellRows, colorColumn);

      // Pre-collect values so the union range is known before KDE runs.
      interface Bucket {
        values: number[];
        source: (typeof yEntries)[number]["source"];
        yIndex: number;
        catIndex: number;
        categoryValue: string | number | null;
        key: string;
      }
      const buckets: Bucket[] = yEntries.flatMap(({ source }, yIndex) =>
        globalCategoryValues.map((categoryValue, catIndex) => {
          const key = globalCategoryKeys[catIndex];
          const indices = cellIndicesByCategory.get(key) ?? [];
          const values = indices
            .map((i) => coerceCell(cellRows[i][source.columnName]))
            .filter((v): v is number => typeof v === "number");
          return { values, source, yIndex, catIndex, categoryValue, key };
        }),
      );
      const fixedRange = unionRangeOf(buckets.map((b) => b.values));

      return buckets
        .map((b): LineSeriesData | null => {
          const baseName = b.source.alias ?? b.source.columnName;
          const categoryLabel = b.categoryValue == null ? "(none)" : String(b.categoryValue);
          const seriesColor = getCategoryColor(
            b.catIndex + b.yIndex * globalCategoryValues.length,
            colorMap,
            b.key,
            baseName,
          );
          return buildSeries(
            b.values,
            yEntries.length === 1 ? categoryLabel : `${baseName} - ${categoryLabel}`,
            seriesColor,
            yEntries.length > 1 ? baseName : undefined,
            xaxisId,
            yaxisId,
            showlegend,
            fixedRange,
          );
        })
        .filter((s): s is LineSeriesData => s !== null);
    },
  );
}
