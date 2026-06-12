"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { RadarPlot } from "@repo/ui/components/charts/radar";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformRadarData } from "./transform";

export function RadarRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const yColumnsCount = dataSources.filter(
    (ds) => ds.role === "y" && ds.columnName.length > 0,
  ).length;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    enabled: yColumnsCount >= 3,
  });

  // KEEP IN SYNC with the field reads in `transformRadarData`.
  const { series, categories } = useMemo(() => {
    if (visualization.chartType !== "radar") {
      return { series: [], categories: [] };
    }
    return transformRadarData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.radarFill,
    chartConfig.radarFillOpacity,
    chartConfig.radarLineWidth,
    chartConfig.radarShowMarkers,
    chartConfig.colorMap,
  ]);

  if (visualization.chartType !== "radar") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const hasRows = yColumnsCount >= 3 && rows.length > 0 && series.length > 0;

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <RadarPlot data={series} categories={categories} config={chartConfig} />
      </div>
    </ChartFrame>
  );
}
