"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { PieChart } from "@repo/ui/components/charts/pie-chart";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { rowKeyForFunction } from "../../data/aggregation";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformPieData } from "./transform";

export function PieRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  // No `orderBy` for pie: slice ordering is decided by Plotly's `sort`
  // setting (largest-first by default), not row order.
  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const aggregation = visualization.dataConfig.aggregation;

  // KEEP IN SYNC with the field reads in `transformPieData`.
  const slices = useMemo(() => {
    if (visualization.chartType !== "pie") {
      return [];
    }
    return transformPieData(rows, dataSources, aggregation, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    aggregation,
    visualization.chartType,
    chartConfig.colorMap,
    chartConfig.hole,
    chartConfig.textinfo,
    chartConfig.pieTextPosition,
    chartConfig.sortSlices,
  ]);

  if (visualization.chartType !== "pie") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const labelsColumn = dataSources.find((ds) => ds.role === "labels")?.columnName;
  const valuesColumn = dataSources.find((ds) => ds.role === "values")?.columnName;
  const aggregateFn = aggregation?.functions?.[0];
  const valueRowKey = aggregateFn ? rowKeyForFunction(aggregateFn) : valuesColumn;
  const canDraw = Boolean(labelsColumn) && Boolean(valueRowKey);

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={rows.length > 0 && canDraw}
    >
      <div className="flex h-full w-full flex-col">
        <PieChart data={slices} config={chartConfig} />
      </div>
    </ChartFrame>
  );
}
