"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { Histogram } from "@repo/ui/components/charts/histogram";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformHistogramData } from "./transform";

export function HistogramRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  // No orderBy: bins are order-independent, so skip the alias handshake.
  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const orientation = chartConfig.histogramOrientation === "h" ? "h" : "v";

  // KEEP IN SYNC with the field reads in `transformHistogramData`.
  const { chartSeries, subplots } = useMemo(() => {
    if (visualization.chartType !== "histogram") {
      return { chartSeries: [], subplots: undefined };
    }
    return transformHistogramData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.histogramOrientation,
    chartConfig.color,
    chartConfig.colorMap,
    chartConfig.marker?.opacity,
    chartConfig.nbinsx,
    chartConfig.histnorm,
    chartConfig.cumulative,
    chartConfig.showNormalFit,
    chartConfig.facetColumns,
    chartConfig.facetSharedX,
    chartConfig.facetSharedY,
    chartConfig.facetSharedXTitle,
    chartConfig.facetSharedYTitle,
    chartConfig.facetRowOrder,
  ]);

  if (visualization.chartType !== "histogram") {
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
        <Histogram
          data={chartSeries}
          config={chartConfig}
          barmode={chartConfig.histogramBarmode ?? "overlay"}
          orientation={orientation}
          fitOverlay={chartConfig.showNormalFit ? "normal" : undefined}
          subplots={subplots}
        />
      </div>
    </ChartFrame>
  );
}
