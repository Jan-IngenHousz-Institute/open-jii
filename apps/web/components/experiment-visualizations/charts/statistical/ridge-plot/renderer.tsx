"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { RidgePlot } from "@repo/ui/components/charts/ridge-plot";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformRidgePlotData } from "./transform";

export function RidgePlotRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const yColumn = dataSources.find((ds) => ds.role === "y")?.columnName;
  const colorColumn = dataSources.find((ds) => ds.role === "color")?.columnName;

  const fill = chartConfig.ridgeFill !== false;
  const lineWidth = chartConfig.ridgeLineWidth ?? 1.5;
  const fillOpacity =
    typeof chartConfig.marker?.opacity === "number" ? chartConfig.marker.opacity : 0.7;

  // KEEP IN SYNC with the field reads in `transformRidgePlotData`.
  const ridges = useMemo(() => {
    if (visualization.chartType !== "ridge-plot") {
      return { series: [], ticks: [] };
    }
    return transformRidgePlotData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.ridgeOverlap,
    chartConfig.ridgeSortOrder,
    chartConfig.colorMap,
  ]);

  if (visualization.chartType !== "ridge-plot") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const hasRows = rows.length > 0 && Boolean(yColumn) && Boolean(colorColumn);

  // No axis-title shelf on this chart; default to the picked column names.
  const ridgeConfig = {
    ...chartConfig,
    xAxisTitle: chartConfig.xAxisTitle?.length ? chartConfig.xAxisTitle : (yColumn ?? ""),
    yAxisTitle: chartConfig.yAxisTitle?.length ? chartConfig.yAxisTitle : (colorColumn ?? ""),
  };

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <RidgePlot
          data={ridges.series}
          categoryTicks={ridges.ticks}
          config={ridgeConfig}
          lineWidth={lineWidth}
          fill={fill}
          fillOpacity={fillOpacity}
        />
      </div>
    </ChartFrame>
  );
}
