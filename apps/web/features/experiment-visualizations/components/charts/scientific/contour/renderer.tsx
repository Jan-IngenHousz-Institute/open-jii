"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { ContourPlot } from "@repo/ui/components/charts/contour";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import type { ContourDegenerateReason, ContourTransformResult } from "./transform";
import { transformContourData } from "./transform";

export function ContourRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;

  // KEEP IN SYNC with the field reads in `transformContourData`.
  const { series, degenerateReason } = useMemo((): ContourTransformResult => {
    if (visualization.chartType !== "contour") {
      return { series: [], degenerateReason: null };
    }
    return transformContourData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.contourColoring,
    chartConfig.contourShowLines,
    chartConfig.contourShowLabels,
    chartConfig.contourSmoothing,
    chartConfig.contourLineWidth,
    chartConfig.contourNcontours,
    chartConfig.contourColorscale,
    chartConfig.contourReverseScale,
    chartConfig.contourShowColorbar,
    chartConfig.contourColorbarTitle,
  ]);

  if (visualization.chartType !== "contour") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  if (degenerateReason !== null) {
    const messageKeyByReason: Record<ContourDegenerateReason, string> = {
      sameColumnAxes: "errors.contourSameColumnAxes",
      singleAxisValue: "errors.contourSingleAxisValue",
      flatZ: "errors.contourFlatZ",
      sparseGrid: "errors.contourSparseGrid",
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
        <ContourPlot data={series} config={chartConfig} />
      </div>
    </ChartFrame>
  );
}
