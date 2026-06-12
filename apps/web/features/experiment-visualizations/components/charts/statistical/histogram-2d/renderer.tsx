"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { Histogram2D } from "@repo/ui/components/charts/histogram";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformHistogram2DData } from "./transform";

export function Histogram2DRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  // No `orderBy`: Plotly's histogram2d trace is invariant to row order.
  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;

  // KEEP IN SYNC with the field reads in `transformHistogram2DData`.
  const series = useMemo(() => {
    if (visualization.chartType !== "histogram-2d") {
      return [];
    }
    return transformHistogram2DData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.hist2dNbinsX,
    chartConfig.hist2dNbinsY,
    chartConfig.hist2dHistnorm,
    chartConfig.hist2dColorscale,
    chartConfig.hist2dReverseScale,
    chartConfig.hist2dShowColorbar,
    chartConfig.hist2dColorbarTitle,
  ]);

  if (visualization.chartType !== "histogram-2d") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const xColumn = dataSources.find((ds) => ds.role === "x")?.columnName;
  const yColumn = dataSources.find((ds) => ds.role === "y")?.columnName;

  const hasRows = rows.length > 0 && Boolean(xColumn) && Boolean(yColumn);

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <Histogram2D
          data={series}
          config={chartConfig}
          renderMode={chartConfig.hist2dRenderMode === "contour" ? "contour" : "heatmap"}
          contourFill={Boolean(chartConfig.hist2dContourFill)}
        />
      </div>
    </ChartFrame>
  );
}
