"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import { LineChart } from "@repo/ui/components/charts/line-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { ChartConfigError, ChartFrame } from "../chart-frame";
import { applyRowFilters } from "../data-filters";
import type { RowFilter } from "../data-filters";
import { dataSourcesByRole } from "../form-values";
import { buildXValues, coerceCell, resolveSeries } from "../series-helpers";
import type { ChartRendererProps } from "../types";
import { useChartData } from "../use-chart-data";

export function LineRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const xColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "x")[0]?.source
    .columnName;
  // Both `dataSourcesByRole` and `resolveSeries` allocate fresh arrays on
  // every call, which would defeat the chartSeries useMemo below — Plotly
  // would redraw on every parent render. Cache through useMemo so identity
  // is stable across renders that don't actually change inputs.
  const yEntries = useMemo(
    () => dataSourcesByRole(visualization.dataConfig.dataSources, "y"),
    [visualization.dataConfig.dataSources],
  );

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn,
  });

  // Row pre-filters narrow the dataset before series construction so the
  // chart agrees with the bar's filter semantics — same `dataConfig.filters`
  // shape, same client-side evaluator.
  const filters = visualization.dataConfig.filters as RowFilter[] | undefined;
  const filteredRows = useMemo(() => applyRowFilters(rows, filters), [rows, filters]);

  const { effectiveYEntries, useIndexForX } = useMemo(
    () => resolveSeries(yEntries, xColumn),
    [yEntries, xColumn],
  );

  const chartSeries = useMemo<LineSeriesData[]>(() => {
    if (visualization.chartType !== "line") return [];
    if (effectiveYEntries.length === 0) return [];

    const chartConfig = visualization.config as PlotlyChartConfig & Omit<LineSeriesData, "x" | "y">;
    return effectiveYEntries.map(({ source }, index) => ({
      x: buildXValues(filteredRows, xColumn, useIndexForX),
      y: filteredRows.map((row) => coerceCell(row[source.columnName])),
      name: source.alias ?? source.columnName,
      color: Array.isArray(chartConfig.color) ? chartConfig.color[index] : chartConfig.color,
      mode: chartConfig.mode,
      line: chartConfig.line,
      marker: chartConfig.marker,
      connectgaps: chartConfig.connectgaps,
      fill: chartConfig.fill,
      fillcolor: chartConfig.fillcolor,
      text: chartConfig.text,
      textposition: chartConfig.textposition,
      textfont: chartConfig.textfont,
      error_x: chartConfig.error_x,
      error_y: chartConfig.error_y,
    }));
  }, [
    filteredRows,
    xColumn,
    effectiveYEntries,
    useIndexForX,
    visualization.chartType,
    visualization.config,
  ]);

  if (visualization.chartType !== "line") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const chartConfig = visualization.config as PlotlyChartConfig;
  // When X is synthesised from row indices (single-column draft state),
  // override xAxisType — Plotly would otherwise try to render integer
  // indices on a date / category axis based on the user's column-pick
  // auto-selection, producing nonsense ticks.
  const effectiveConfig: PlotlyChartConfig = {
    ...chartConfig,
    xAxisType: useIndexForX ? "linear" : chartConfig.xAxisType,
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
        <LineChart data={chartSeries} config={effectiveConfig} />
      </div>
    </ChartFrame>
  );
}
