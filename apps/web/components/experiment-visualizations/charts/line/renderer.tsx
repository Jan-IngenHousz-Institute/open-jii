"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import { LineChart } from "@repo/ui/components/charts/line-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { ChartConfigError, ChartFrame } from "../chart-frame";
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
  const yEntries = dataSourcesByRole(visualization.dataConfig.dataSources, "y");

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn,
  });

  // Hoisted out of the useMemo so the bottom-level `effectiveConfig` can
  // also branch on `useIndexForX` — when X is synthesised, the user's
  // auto-picked xAxisType ("date" for a timestamp column, etc.) no
  // longer matches the actual integer indices being plotted.
  const { effectiveYEntries, useIndexForX } = resolveSeries(yEntries, xColumn);

  const chartSeries = useMemo<LineSeriesData[]>(() => {
    if (visualization.chartType !== "line") return [];
    if (effectiveYEntries.length === 0) return [];

    const chartConfig = visualization.config as PlotlyChartConfig & Omit<LineSeriesData, "x" | "y">;
    return effectiveYEntries.map(({ source }, index) => ({
      x: buildXValues(rows, xColumn, useIndexForX),
      y: rows.map((row) => coerceCell(row[source.columnName])),
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
    rows,
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
      // We pass `hasRows` as just "did the API return rows?" so that an
      // X-only / Y-only draft state still renders the chart frame with the
      // configured axis. Plotly handles an empty `data` array by drawing
      // axes only — no synthesised series.
      hasRows={rows.length > 0}
    >
      <div className="flex h-full w-full flex-col">
        <LineChart data={chartSeries} config={effectiveConfig} />
      </div>
    </ChartFrame>
  );
}
