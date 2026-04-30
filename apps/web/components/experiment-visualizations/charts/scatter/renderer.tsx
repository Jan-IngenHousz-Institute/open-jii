"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import type { ScatterSeriesData } from "@repo/ui/components/charts/scatter-chart";
import { ScatterChart } from "@repo/ui/components/charts/scatter-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { ChartConfigError, ChartFrame } from "../chart-frame";
import { dataSourcesByRole, getCategoryColor } from "../form-values";
import type { ChartFormConfig } from "../form-values";
import { buildXValues, coerceCell, resolveSeries } from "../series-helpers";
import type { ChartRendererProps } from "../types";
import { useChartData } from "../use-chart-data";

export function ScatterRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const xColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "x")[0]?.source
    .columnName;
  const yEntries = dataSourcesByRole(visualization.dataConfig.dataSources, "y");
  const colorColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "color")[0]?.source
    .columnName;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn,
  });

  const chartConfig = visualization.config as PlotlyChartConfig &
    Omit<ScatterSeriesData, "x" | "y"> &
    Pick<ChartFormConfig, "colorMode" | "colorMap">;

  const isCategoricalColor =
    Boolean(colorColumn) && chartConfig.colorMode === "categorical";

  const scatterData = useMemo<ScatterSeriesData[]>(() => {
    if (visualization.chartType !== "scatter") return [];
    const { effectiveYEntries, useIndexForX } = resolveSeries(yEntries, xColumn);
    if (effectiveYEntries.length === 0) return [];

    const xValues = buildXValues(rows, xColumn, useIndexForX);

    if (isCategoricalColor && colorColumn) {
      // Multi-trace path: emit one trace per unique value of the color column
      // (per Y series). Plotly's legend then lists each category with its
      // color and supports show/hide toggling per category. We pre-build
      // per-category index buckets in a single pass to keep this O(n).
      const categoryIndexMap = new Map<string, number[]>();
      for (let i = 0; i < rows.length; i++) {
        const key = String(rows[i][colorColumn]);
        const bucket = categoryIndexMap.get(key);
        if (bucket) {
          bucket.push(i);
        } else {
          categoryIndexMap.set(key, [i]);
        }
      }
      const categoryKeys = Array.from(categoryIndexMap.keys());

      const traces: ScatterSeriesData[] = [];
      for (let yIdx = 0; yIdx < effectiveYEntries.length; yIdx++) {
        const ySource = effectiveYEntries[yIdx].source;
        const yValues = rows.map((row) => coerceCell(row[ySource.columnName]));

        for (let cIdx = 0; cIdx < categoryKeys.length; cIdx++) {
          const category = categoryKeys[cIdx];
          const indices = categoryIndexMap.get(category) ?? [];
          const traceX = indices.map((i) => xValues[i]);
          const traceY = indices.map((i) => yValues[i]);
          // With multiple Y series + categorical, qualify the legend entry so
          // the user can tell traces apart (`Yseries - category`). With a
          // single Y series, the category alone is sufficient.
          const yLabel = ySource.alias ?? ySource.columnName;
          const name = effectiveYEntries.length > 1 ? `${yLabel} - ${category}` : category;
          const color = getCategoryColor(cIdx, chartConfig.colorMap, category);

          traces.push({
            x: traceX,
            y: traceY,
            name,
            mode: chartConfig.mode,
            marker: {
              size: chartConfig.marker?.size,
              symbol: chartConfig.marker?.symbol,
              color,
            },
            line: chartConfig.line,
            text: chartConfig.text,
            textposition: chartConfig.textposition,
            textfont: chartConfig.textfont,
            error_x: chartConfig.error_x,
            error_y: chartConfig.error_y,
            fill: chartConfig.fill,
            fillcolor: chartConfig.fillcolor,
            // Group traces sharing the same Y series so toggling one category
            // doesn't affect another series with the same name.
            legendgroup: effectiveYEntries.length > 1 ? yLabel : undefined,
          });
        }
      }
      return traces;
    }

    // Continuous (or no color column): one trace per Y series, with the
    // existing colorscale/colorbar treatment.
    return effectiveYEntries.map(({ source }, index) => {
      const yValues = rows.map((row) => coerceCell(row[source.columnName]));
      const colorValues = colorColumn ? rows.map((row) => String(row[colorColumn])) : undefined;

      const color =
        colorValues ??
        (Array.isArray(chartConfig.color) ? chartConfig.color[index] : chartConfig.color);
      const colorscale = colorValues ? chartConfig.marker?.colorscale : undefined;
      const showscale = colorValues ? chartConfig.marker?.showscale : undefined;
      const colorbar =
        colorValues && chartConfig.marker?.showscale
          ? {
              title: {
                text: chartConfig.marker.colorbar?.title?.text,
                font: {
                  color: chartConfig.marker.colorbar?.title?.font?.color,
                  size: chartConfig.marker.colorbar?.title?.font?.size,
                  family: chartConfig.marker.colorbar?.title?.font?.family,
                },
                side: chartConfig.marker.colorbar?.title?.side,
              },
              thickness: 15,
              len: 0.9,
            }
          : undefined;

      return {
        x: xValues,
        y: yValues,
        name: source.alias ?? source.columnName,
        mode: chartConfig.mode,
        marker: {
          size: chartConfig.marker?.size,
          symbol: chartConfig.marker?.symbol,
          color,
          colorscale,
          showscale,
          colorbar,
        },
        line: chartConfig.line,
        text: chartConfig.text,
        textposition: chartConfig.textposition,
        textfont: chartConfig.textfont,
        error_x: chartConfig.error_x,
        error_y: chartConfig.error_y,
        fill: chartConfig.fill,
        fillcolor: chartConfig.fillcolor,
      };
    });
  }, [rows, xColumn, yEntries, colorColumn, isCategoricalColor, chartConfig, visualization.chartType]);

  if (visualization.chartType !== "scatter") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  // Categorical mode emits potentially many traces. Switching to scattergl
  // keeps a single shared GPU context for all traces, so trace count stays
  // cheap even with hundreds of categories.
  const effectiveConfig: PlotlyChartConfig = {
    ...chartConfig,
    autosizable: true,
    useWebGL: chartConfig.useWebGL || isCategoricalColor,
  };

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={rows.length > 0 && scatterData.length > 0}
    >
      <div className="flex h-full w-full flex-col">
        <ScatterChart data={scatterData} config={effectiveConfig} />
      </div>
    </ChartFrame>
  );
}
