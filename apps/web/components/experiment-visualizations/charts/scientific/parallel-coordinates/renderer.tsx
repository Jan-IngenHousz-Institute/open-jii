"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { ParallelCoordinates } from "@repo/ui/components/charts/parallel-coordinates";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformParallelCoordinatesData } from "./transform";

export function ParallelCoordinatesRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const distinctYCount = new Set(
    dataSources
      .filter((ds) => ds.role === "y" && ds.columnName.length > 0)
      .map((ds) => ds.columnName),
  ).size;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    enabled: distinctYCount >= 2,
  });

  // KEEP IN SYNC with the field reads in `transformParallelCoordinatesData`.
  const { series, axes } = useMemo(() => {
    if (visualization.chartType !== "parallel-coordinates") {
      return { series: [], axes: [] };
    }
    return transformParallelCoordinatesData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.colorMode,
    chartConfig.colorMap,
    chartConfig.marker?.colorscale,
    chartConfig.marker?.reversescale,
    chartConfig.marker?.showscale,
    chartConfig.marker?.colorbar?.title?.text,
    chartConfig.marker?.colorbar?.title?.side,
    chartConfig.parcoordsLineWidth,
    chartConfig.parcoordsLineOpacity,
  ]);

  if (visualization.chartType !== "parallel-coordinates") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const hasRows = axes.length >= 2 && rows.length > 0 && series.length > 0;

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <ParallelCoordinates data={series} config={chartConfig} />
      </div>
    </ChartFrame>
  );
}
