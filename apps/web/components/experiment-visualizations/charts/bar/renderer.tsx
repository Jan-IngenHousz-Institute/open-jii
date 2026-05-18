"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import type { BarSeriesData } from "@repo/ui/components/charts/bar-chart";
import { BarChart } from "@repo/ui/components/charts/bar-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { ChartConfigError, ChartFrame } from "../chart-frame";
import { applyRowFilters } from "../data-filters";
import type { RowFilter } from "../data-filters";
import type { ChartFormConfig } from "../form-values";
import { dataSourcesByRole, getCategoryColor } from "../form-values";
import type { ChartRendererProps } from "../types";
import { useChartData } from "../use-chart-data";
import type { AggregationFunction } from "./aggregate";
import { applyTopN, groupAndAggregate } from "./aggregate";

type BarConfig = PlotlyChartConfig & ChartFormConfig;

export function BarRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const xColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "x")[0]?.source
    .columnName;
  const yColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "y")[0]?.source
    .columnName;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);

  const chartConfig = visualization.config as BarConfig;
  const aggregationFunction: AggregationFunction = chartConfig.aggregationFunction ?? "count";
  const orientation = chartConfig.orientation === "h" ? "h" : "v";
  const sortDirection = chartConfig.sortDirection ?? null;
  const topN = typeof chartConfig.topN === "number" ? chartConfig.topN : undefined;
  // The data panel records the picked x column's database type so the
  // aggregator can branch on CONTRIBUTOR / QUESTIONS cells. Other column
  // kinds fall through the aggregator's plain-string-key path.
  const xColumnType = chartConfig.xColumnType;
  const questionLabel = chartConfig.questionLabel;

  // dataConfig.filters is the schema-defined home for row filters. The bar
  // chart honours `equals` filters AND-combined before aggregation; rows
  // not matching every active filter never reach `groupAndAggregate`.
  const filters = visualization.dataConfig.filters as RowFilter[] | undefined;
  const filteredRows = useMemo(() => applyRowFilters(rows, filters), [rows, filters]);

  const buckets = useMemo(
    () =>
      groupAndAggregate(filteredRows, xColumn, xColumnType, yColumn, aggregationFunction, {
        questionLabel,
      }),
    [filteredRows, xColumn, xColumnType, yColumn, aggregationFunction, questionLabel],
  );

  const displayBuckets = useMemo(
    () => applyTopN(buckets, sortDirection, topN),
    [buckets, sortDirection, topN],
  );

  const barData = useMemo<BarSeriesData[]>(() => {
    if (visualization.chartType !== "bar") return [];
    if (displayBuckets.length === 0) return [];

    // Plotly's categorical y-axis renders entries bottom-up in the order
    // it receives them, which flips the reading direction for a "highest
    // first" horizontal leaderboard — #1 would land at the visual bottom.
    // Reverse the input for horizontal+sorted so the rank order reads
    // top-down without touching the underlying bucket order downstream
    // code might rely on.
    // Only reverse when sorting is actually active — any invalid persisted
    // value should leave bar order untouched.
    const isSorted = sortDirection === "asc" || sortDirection === "desc";
    const ordered =
      orientation === "h" && isSorted ? [...displayBuckets].reverse() : displayBuckets;

    const labels = ordered.map((b) => b.label);
    const values = ordered.map((b) => b.value);
    const colors = ordered.map((b, i) => getCategoryColor(i, chartConfig.colorMap, b.key));

    const seriesName = yColumn || (aggregationFunction === "count" ? "Count" : aggregationFunction);
    const hovertemplate =
      orientation === "h"
        ? "<b>%{y}</b><br>%{x}<extra></extra>"
        : "<b>%{x}</b><br>%{y}<extra></extra>";

    const series: BarSeriesData = {
      x: orientation === "h" ? values : labels,
      y: orientation === "h" ? labels : values,
      name: seriesName,
      orientation,
      marker: { color: colors },
      hovertemplate,
    };
    return [series];
  }, [
    displayBuckets,
    orientation,
    sortDirection,
    yColumn,
    aggregationFunction,
    chartConfig.colorMap,
    visualization.chartType,
  ]);

  if (visualization.chartType !== "bar") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  // For horizontal bars the dependent (numeric) axis is X and the
  // categorical labels live on Y; flip the configured axis types so
  // Plotly draws the right scale on each side regardless of orientation.
  const effectiveConfig: PlotlyChartConfig = {
    ...chartConfig,
    autosizable: true,
    xAxisType: orientation === "h" ? (chartConfig.xAxisType ?? "linear") : "category",
    yAxisType: orientation === "h" ? "category" : (chartConfig.yAxisType ?? "linear"),
  };

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={filteredRows.length > 0}
    >
      <div className="flex h-full w-full flex-col">
        <BarChart data={barData} config={effectiveConfig} />
      </div>
    </ChartFrame>
  );
}
