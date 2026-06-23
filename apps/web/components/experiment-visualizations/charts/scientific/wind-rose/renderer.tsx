"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { WindRose } from "@repo/ui/components/charts/wind-rose";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { defaultLabelsFor, transformWindRoseData } from "./transform";

export function WindRoseRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const xColumn = dataSources.find((ds) => ds.role === "x")?.columnName;
  const yColumn = dataSources.find((ds) => ds.role === "y")?.columnName;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    enabled: Boolean(xColumn) && Boolean(yColumn),
  });

  const directionBins = (chartConfig.windRoseDirectionBins ?? 8) as number;
  const showLabels = chartConfig.windRoseShowDirectionLabels !== false;

  // KEEP IN SYNC with the field reads in `transformWindRoseData`.
  const { series, hasData } = useMemo(() => {
    if (visualization.chartType !== "wind-rose") {
      return { series: [], hasData: false };
    }
    return transformWindRoseData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.windRoseDirectionBins,
    chartConfig.windRoseValueBins,
    chartConfig.windRoseColorscale,
    chartConfig.windRoseReverseScale,
  ]);

  if (visualization.chartType !== "wind-rose") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const directionTicks = Array.from({ length: directionBins }, (_, i) => i * (360 / directionBins));
  const directionLabels = showLabels ? defaultLabelsFor(directionBins) : [];

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasData}
    >
      <div className="flex h-full w-full flex-col">
        <WindRose
          data={series}
          config={chartConfig}
          directionTicks={directionTicks}
          directionLabels={directionLabels}
          radialAxisTitle={yColumn ?? t("workspace.style.windRoseRadialAxisTitle")}
        />
      </div>
    </ChartFrame>
  );
}
