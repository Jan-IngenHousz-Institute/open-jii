"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { LineChart } from "@repo/ui/components/charts/line-chart";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformDensityPlotData } from "./transform";

export function DensityPlotRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  // No `orderBy`: KDE is invariant to row order.
  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;

  // KEEP IN SYNC with the field reads in `transformDensityPlotData`.
  const { chartSeries, subplots } = useMemo(() => {
    if (visualization.chartType !== "density-plot") {
      return { chartSeries: [], subplots: undefined };
    }
    return transformDensityPlotData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.densityOrientation,
    chartConfig.densityCumulative,
    chartConfig.densityFill,
    chartConfig.densityLineWidth,
    chartConfig.color,
    chartConfig.colorMap,
    chartConfig.marker?.opacity,
    chartConfig.facetColumns,
    chartConfig.facetSharedX,
    chartConfig.facetSharedY,
    chartConfig.facetSharedXTitle,
    chartConfig.facetSharedYTitle,
    chartConfig.facetRowOrder,
  ]);

  if (visualization.chartType !== "density-plot") {
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
        <LineChart data={chartSeries} config={chartConfig} subplots={subplots} />
      </div>
    </ChartFrame>
  );
}
