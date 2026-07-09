"use client";

import { useMemo } from "react";

import type { SeriesTraceType } from "@repo/api/schemas/experiment.schema";
import { CartesianChart } from "@repo/ui/components/charts/cartesian-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { narrowChartConfig } from "../chart-config";
import { ChartFrame } from "../chart-frame";
import { useChartData } from "../hooks/use-chart-data";
import type { ChartRendererProps } from "../types";
import { transformCartesianData } from "./cartesian-transform";

interface CartesianRendererProps extends ChartRendererProps {
  defaultTraceType: SeriesTraceType;
  supportsContinuousColor?: boolean;
  supportsSize?: boolean;
}

// Above this total point count SVG starts to jank and WebGL earns its context.
const WEBGL_POINT_THRESHOLD = 5000;

export function CartesianRenderer({
  visualization,
  experimentId,
  data: providedData,
  defaultTraceType,
  supportsContinuousColor = false,
  supportsSize = false,
}: CartesianRendererProps) {
  const dataSources = visualization.dataConfig.dataSources;
  const xColumn = dataSources.find((ds) => ds.role === "x")?.columnName;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn,
  });

  const chartConfig = narrowChartConfig(visualization);

  // KEEP IN SYNC with field reads in `transformCartesianData` and its helpers.
  // Re-derive: `grep -oE 'chartConfig\\.[a-zA-Z_]+' cartesian-transform.ts | sort -u`.
  const { chartSeries, subplots, useIndexForX } = useMemo(() => {
    return transformCartesianData(rows, dataSources, chartConfig, {
      defaultTraceType,
      supportsContinuousColor,
      supportsSize,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    defaultTraceType,
    supportsContinuousColor,
    supportsSize,
    chartConfig.bubbleMaxSize,
    chartConfig.bubbleMinSize,
    chartConfig.color,
    chartConfig.colorMap,
    chartConfig.colorMode,
    chartConfig.connectgaps,
    chartConfig.errorBarCapWidth,
    chartConfig.errorBarThickness,
    chartConfig.error_x,
    chartConfig.error_y,
    chartConfig.facetColumns,
    chartConfig.facetRowOrder,
    chartConfig.facetSharedX,
    chartConfig.facetSharedXTitle,
    chartConfig.facetSharedY,
    chartConfig.facetSharedYTitle,
    chartConfig.fill,
    chartConfig.fillOpacity,
    chartConfig.fillcolor,
    chartConfig.line,
    chartConfig.marker,
    chartConfig.mode,
    chartConfig.orientation,
    chartConfig.sizemode,
    chartConfig.stackMode,
    chartConfig.text,
    chartConfig.textfont,
    chartConfig.textposition,
  ]);

  // WebGL avoids SVG jank on large datasets, but each gl trace holds a scarce
  // browser WebGL context; a dashboard full of gl charts exhausts the pool and
  // the data layer vanishes on context loss. Auto-enable only for genuinely
  // large charts so small (grouped) ones stay on SVG and cost no context.
  const totalPoints = chartSeries.reduce((sum, s) => sum + s.y.length, 0);

  const effectiveConfig: PlotlyChartConfig = {
    ...chartConfig,
    xAxisType: useIndexForX ? "linear" : chartConfig.xAxisType,
    useWebGL: chartConfig.useWebGL ?? totalPoints > WEBGL_POINT_THRESHOLD,
  };

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={rows.length > 0}
    >
      <div className="flex h-full w-full flex-col">
        <CartesianChart data={chartSeries} config={effectiveConfig} subplots={subplots} />
      </div>
    </ChartFrame>
  );
}
