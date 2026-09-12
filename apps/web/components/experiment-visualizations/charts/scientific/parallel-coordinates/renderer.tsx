"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { ParallelCoordinates } from "@repo/ui/components/charts/parallel-coordinates";
import { useChartThemeRefresh } from "@repo/ui/components/charts/use-chart-theme-refresh";

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

  // The transform below resolves category colours, so this has to re-run on a
  // theme swap or the traces keep the outgoing palette.
  const themeVersion = useChartThemeRefresh();

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
    themeVersion,
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
