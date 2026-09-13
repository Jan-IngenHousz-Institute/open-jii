"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { TernaryPlot } from "@repo/ui/components/charts/ternary";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformTernaryData } from "./transform";

export function TernaryRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const aColumn = dataSources.find((ds) => ds.role === "x")?.columnName;
  const bColumn = dataSources.find((ds) => ds.role === "y")?.columnName;
  const cColumn = dataSources.find((ds) => ds.role === "z")?.columnName;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    enabled: Boolean(aColumn) && Boolean(bColumn) && Boolean(cColumn),
  });

  const sum = chartConfig.ternarySum ?? 100;

  // KEEP IN SYNC with the field reads in `transformTernaryData`.
  const { series } = useMemo(() => {
    if (visualization.chartType !== "ternary") {
      return { series: [], aColumn: undefined, bColumn: undefined, cColumn: undefined };
    }
    return transformTernaryData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.colorMode,
    chartConfig.colorMap,
    chartConfig.ternaryMode,
    chartConfig.ternaryMarkerSize,
    chartConfig.ternaryLineWidth,
    chartConfig.ternarySum,
  ]);

  if (visualization.chartType !== "ternary") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const hasRows =
    Boolean(aColumn) &&
    Boolean(bColumn) &&
    Boolean(cColumn) &&
    rows.length > 0 &&
    series.length > 0;

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <TernaryPlot
          data={series}
          config={chartConfig}
          sum={sum}
          aaxis={{ title: aColumn, showgrid: chartConfig.showGrid !== false }}
          baxis={{ title: bColumn, showgrid: chartConfig.showGrid !== false }}
          caxis={{ title: cColumn, showgrid: chartConfig.showGrid !== false }}
        />
      </div>
    </ChartFrame>
  );
}
