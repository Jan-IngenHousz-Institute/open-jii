"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { PolarPlot } from "@repo/ui/components/charts/polar";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformPolarData } from "./transform";

export function PolarRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const xColumn = dataSources.find((ds) => ds.role === "x")?.columnName;
  const hasYPicks = dataSources.some((ds) => ds.role === "y" && ds.columnName.length > 0);

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    enabled: Boolean(xColumn) && hasYPicks,
  });

  // KEEP IN SYNC with the field reads in `transformPolarData`.
  const series = useMemo(() => {
    if (visualization.chartType !== "polar") {
      return [];
    }
    return transformPolarData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.colorMode,
    chartConfig.colorMap,
    chartConfig.polarMode,
    chartConfig.polarLineWidth,
    chartConfig.polarMarkerSize,
    chartConfig.polarFill,
  ]);

  if (visualization.chartType !== "polar") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  // Map config → wrapper's angular-axis layout so users get the
  // compass convention by default (0° at top, clockwise sweep).
  const showGrid = chartConfig.showGrid !== false;
  const angularAxis = {
    direction: chartConfig.polarDirection ?? "clockwise",
    rotation: chartConfig.polarStartAngle ?? 90,
    showgrid: showGrid,
  };
  const radialAxis = { showgrid: showGrid };

  const hasRows = Boolean(xColumn) && hasYPicks && rows.length > 0 && series.length > 0;

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <PolarPlot
          data={series}
          config={chartConfig}
          angularAxis={angularAxis}
          radialAxis={radialAxis}
        />
      </div>
    </ChartFrame>
  );
}
