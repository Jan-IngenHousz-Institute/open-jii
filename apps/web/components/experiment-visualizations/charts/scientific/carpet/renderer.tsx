"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { CarpetPlot } from "@repo/ui/components/charts/carpet";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import type { CarpetDegenerateReason, CarpetTransformResult } from "./transform";
import { transformCarpetData } from "./transform";

export function CarpetRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;

  // KEEP IN SYNC with the field reads in `transformCarpetData`.
  const { carpetData, contourData, degenerateReason } = useMemo((): CarpetTransformResult => {
    if (visualization.chartType !== "carpet") {
      return {
        carpetData: [],
        contourData: [],
        degenerateReason: null,
      };
    }
    return transformCarpetData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.carpetColorscale,
    chartConfig.carpetReverseScale,
    chartConfig.carpetShowColorbar,
    chartConfig.carpetColorbarTitle,
    chartConfig.carpetNContours,
    chartConfig.carpetContourColoring,
    chartConfig.carpetShowContourLabels,
  ]);

  if (visualization.chartType !== "carpet") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  if (degenerateReason !== null) {
    // Reuse heatmap message keys; failure modes and copy are identical
    // for carpet, so duplicating would mean keeping two translations in sync.
    const messageKeyByReason: Record<CarpetDegenerateReason, string> = {
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

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={
        rows.length > 0 &&
        Boolean(xColumn) &&
        Boolean(yColumn) &&
        Boolean(zColumn) &&
        carpetData.length > 0
      }
    >
      <div className="flex h-full w-full flex-col">
        <CarpetPlot carpetData={carpetData} contourData={contourData} config={chartConfig} />
      </div>
    </ChartFrame>
  );
}
