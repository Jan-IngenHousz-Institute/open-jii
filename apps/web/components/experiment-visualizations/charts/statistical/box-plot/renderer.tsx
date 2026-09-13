"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { BoxPlot } from "@repo/ui/components/charts/box-plot";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformBoxPlotData } from "./transform";

export function BoxPlotRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const orientation = chartConfig.boxOrientation === "h" ? "h" : "v";

  // KEEP IN SYNC with the field reads in `transformBoxPlotData`.
  const { chartSeries, subplots } = useMemo(() => {
    if (visualization.chartType !== "box-plot") {
      return { chartSeries: [], subplots: undefined };
    }
    return transformBoxPlotData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.boxOrientation,
    chartConfig.color,
    chartConfig.colorMap,
    chartConfig.marker?.opacity,
    chartConfig.boxpoints,
    chartConfig.notched,
    chartConfig.boxmean,
    chartConfig.facetColumns,
    chartConfig.facetSharedX,
    chartConfig.facetSharedY,
    chartConfig.facetSharedXTitle,
    chartConfig.facetSharedYTitle,
    chartConfig.facetRowOrder,
  ]);

  if (visualization.chartType !== "box-plot") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={rows.length > 0}
    >
      <div className="flex h-full w-full flex-col">
        <BoxPlot
          data={chartSeries}
          config={chartConfig}
          orientation={orientation}
          boxmode={chartConfig.boxmode ?? "group"}
          subplots={subplots}
        />
      </div>
    </ChartFrame>
  );
}
