"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import type { ScatterSeriesData } from "@repo/ui/components/charts/scatter-chart";
import { ScatterChart } from "@repo/ui/components/charts/scatter-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { ChartConfigError, ChartFrame } from "../chart-frame";
import { applyRowFilters } from "../data-filters";
import type { RowFilter } from "../data-filters";
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
  // Both `dataSourcesByRole` and `resolveSeries` allocate fresh arrays on
  // every call, which would defeat the scatterData useMemo below — Plotly
  // would redraw on every parent render. Cache through useMemo so identity
  // is stable across renders that don't actually change inputs.
  const yEntries = useMemo(
    () => dataSourcesByRole(visualization.dataConfig.dataSources, "y"),
    [visualization.dataConfig.dataSources],
  );
  const colorColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "color")[0]?.source
    .columnName;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn,
  });

  // Row pre-filters narrow the dataset before series construction so the
  // chart agrees with the bar's filter semantics — same `dataConfig.filters`
  // shape, same client-side evaluator.
  const filters = visualization.dataConfig.filters as RowFilter[] | undefined;
  const filteredRows = useMemo(() => applyRowFilters(rows, filters), [rows, filters]);

  const chartConfig = visualization.config as PlotlyChartConfig &
    Omit<ScatterSeriesData, "x" | "y"> &
    Pick<ChartFormConfig, "colorMode" | "colorMap">;

  const isCategoricalColor = Boolean(colorColumn) && chartConfig.colorMode === "categorical";

  const { effectiveYEntries, useIndexForX } = useMemo(
    () => resolveSeries(yEntries, xColumn),
    [yEntries, xColumn],
  );

  const scatterData = useMemo<ScatterSeriesData[]>(() => {
    if (visualization.chartType !== "scatter") return [];
    if (effectiveYEntries.length === 0) return [];

    const xValues = buildXValues(filteredRows, xColumn, useIndexForX);

    if (isCategoricalColor && colorColumn) {
      // Multi-trace path: emit one trace per unique value of the color column
      // (per Y series). Plotly's legend then lists each category with its
      // color and supports show/hide toggling per category. We pre-build
      // per-category index buckets in a single pass to keep this O(n).
      const categoryIndexMap = new Map<string, number[]>();
      for (let i = 0; i < filteredRows.length; i++) {
        const key = String(filteredRows[i][colorColumn]);
        const bucket = categoryIndexMap.get(key);
        if (bucket) {
          bucket.push(i);
        } else {
          categoryIndexMap.set(key, [i]);
        }
      }
      const categoryKeys = Array.from(categoryIndexMap.keys());

      const traces: ScatterSeriesData[] = [];
      for (const yEntry of effectiveYEntries) {
        const ySource = yEntry.source;
        const yValues = filteredRows.map((row) => coerceCell(row[ySource.columnName]));

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
      const yValues = filteredRows.map((row) => coerceCell(row[source.columnName]));
      const colorValues = colorColumn
        ? filteredRows.map((row) => String(row[colorColumn]))
        : undefined;

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
  }, [
    filteredRows,
    xColumn,
    effectiveYEntries,
    useIndexForX,
    colorColumn,
    isCategoricalColor,
    chartConfig,
    visualization.chartType,
  ]);

  if (visualization.chartType !== "scatter") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  // Categorical mode emits potentially many traces. Switching to scattergl
  // keeps a single shared GPU context for all traces, so trace count stays
  // cheap even with hundreds of categories. Force-on whenever categorical
  // is active; otherwise honor whatever the chart config asked for.
  const effectiveConfig: PlotlyChartConfig = {
    ...chartConfig,
    autosizable: true,
    // When X is synthesised from row indices (single-column draft state),
    // override xAxisType — Plotly would otherwise try to render integer
    // indices on a date / category axis based on the user's column-pick
    // auto-selection, producing nonsense ticks.
    xAxisType: useIndexForX ? "linear" : chartConfig.xAxisType,
    useWebGL: isCategoricalColor || chartConfig.useWebGL,
  };

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      // We pass `hasRows` as just "did filtered rows survive?" so that an
      // X-only / Y-only draft state still renders the chart frame with the
      // configured axis. Plotly handles an empty `data` array by drawing
      // axes only — no synthesised series.
      hasRows={filteredRows.length > 0}
    >
      <div className="flex h-full w-full flex-col">
        <ScatterChart data={scatterData} config={effectiveConfig} />
      </div>
    </ChartFrame>
  );
}
