"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { Heatmap } from "@repo/ui/components/charts/heatmap";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import type { HeatmapDegenerateReason, HeatmapTransformResult } from "./transform";
import { transformHeatmapData } from "./transform";

export function HeatmapRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;

  // KEEP IN SYNC with the field reads in `transformHeatmapData`.
  const { series, degenerateReason } = useMemo((): HeatmapTransformResult => {
    if (visualization.chartType !== "heatmap") {
      return { series: [], degenerateReason: null };
    }
    return transformHeatmapData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.heatmapColorscale,
    chartConfig.heatmapReverseScale,
    chartConfig.heatmapShowColorbar,
    chartConfig.heatmapColorbarTitle,
    chartConfig.heatmapZsmooth,
    chartConfig.heatmapShowText,
    chartConfig.heatmapTextDecimals,
  ]);

  if (visualization.chartType !== "heatmap") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  // Specific message for degenerate configs; generic "no data" wouldn't help.
  if (degenerateReason !== null) {
    const messageKeyByReason: Record<HeatmapDegenerateReason, string> = {
      sameColumnAxes: "errors.heatmapSameColumnAxes",
      singleAxisValue: "errors.heatmapSingleAxisValue",
      flatZ: "errors.heatmapFlatZ",
      sparseGrid: "errors.heatmapSparseGrid",
    };
    return <ChartConfigError message={t(messageKeyByReason[degenerateReason])} />;
  }

  const xColumn = dataSources.find((ds) => ds.role === "x")?.columnName;
  const yColumn = dataSources.find((ds) => ds.role === "y")?.columnName;
  const zColumn = dataSources.find((ds) => ds.role === "z")?.columnName;

  const hasRows = rows.length > 0 && Boolean(xColumn) && Boolean(yColumn) && Boolean(zColumn);

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <Heatmap data={series} config={chartConfig} />
      </div>
    </ChartFrame>
  );
}
