"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { ViolinPlot } from "@repo/ui/components/charts/box-plot";
import { useChartThemeRefresh } from "@repo/ui/components/charts/use-chart-theme-refresh";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformViolinPlotData } from "./transform";

export function ViolinPlotRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const orientation = chartConfig.violinOrientation === "h" ? "h" : "v";

  // The transform below resolves category colours, so this has to re-run on a
  // theme swap or the traces keep the outgoing palette.
  const themeVersion = useChartThemeRefresh();

  // KEEP IN SYNC with the field reads in `transformViolinPlotData`.
  const { chartSeries, subplots } = useMemo(() => {
    if (visualization.chartType !== "violin-plot") {
      return { chartSeries: [], subplots: undefined };
    }
    return transformViolinPlotData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.violinOrientation,
    chartConfig.color,
    chartConfig.colorMap,
    chartConfig.marker?.opacity,
    chartConfig.violinPoints,
    chartConfig.violinShowBox,
    chartConfig.violinShowMeanline,
    chartConfig.violinSide,
    chartConfig.violinScalemode,
    chartConfig.violinBoxColor,
    chartConfig.violinMarkerColor,
    chartConfig.facetColumns,
    chartConfig.facetSharedX,
    chartConfig.facetSharedY,
    chartConfig.facetSharedXTitle,
    chartConfig.facetSharedYTitle,
    chartConfig.facetRowOrder,
    themeVersion,
  ]);

  if (visualization.chartType !== "violin-plot") {
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
        <ViolinPlot
          data={chartSeries}
          config={chartConfig}
          orientation={orientation}
          violinmode={chartConfig.violinmode ?? "group"}
          subplots={subplots}
        />
      </div>
    </ChartFrame>
  );
}
