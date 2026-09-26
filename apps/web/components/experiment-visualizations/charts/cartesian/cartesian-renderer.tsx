"use client";

import { CartesianChart } from "@/components/charts/cartesian-chart";
import { useCallback, useMemo, useState } from "react";

import type { ExperimentSeriesTraceType } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import type { CartesianSeries } from "@repo/ui/components/charts/cartesian-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { narrowChartConfig } from "../chart-config";
import { ChartFrame } from "../chart-frame";
import type { ChartResolution } from "../chart-resolution-notice";
import { useAxisRanges } from "../hooks/use-axis-ranges";
import { useChartData } from "../hooks/use-chart-data";
import { useZoomRead } from "../hooks/use-zoom-read";
import type { ChartRendererProps } from "../types";
import { transformCartesianData } from "./cartesian-transform";
import type { AxisRanges } from "./relayout-ranges";
import { axisPosition, reduceSeries } from "./series-reduction";
import type { AxisRange } from "./series-reduction";
import { zoomReadPlanOf } from "./zoom-read-plan";
import type { ZoomReadPlan } from "./zoom-read-plan";

interface CartesianRendererProps extends ChartRendererProps {
  defaultTraceType: ExperimentSeriesTraceType;
  supportsContinuousColor?: boolean;
  supportsSize?: boolean;
}

// Above this many markers SVG starts to jank and WebGL earns its context.
const WEBGL_MARKER_THRESHOLD = 5000;

const NO_ZOOM_READ: ZoomReadPlan = {
  xColumn: "",
  scale: "number",
  yColumns: [],
  splitColumns: [],
  readColumns: [],
};

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

  const { rows, isLoading, error, truncation, filters } = useChartData(
    visualization,
    experimentId,
    providedData,
    {
      orderBy: xColumn,
    },
  );

  const chartConfig = narrowChartConfig(visualization);

  const [isShowingAll, setIsShowingAll] = useState(false);
  const toggleShowingAll = useCallback(() => setIsShowingAll((showing) => !showing), []);
  const { ranges, onRelayout } = useAxisRanges();

  // A series longer than one read is drawn from buckets of the whole table instead of its first rows.
  const zoomReadPlan = useMemo(
    () => zoomReadPlanOf(visualization.dataConfig, chartConfig, defaultTraceType, rows),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stackMode is the only config it reads.
    [visualization.dataConfig, chartConfig.stackMode, defaultTraceType, rows],
  );
  const isZoomReadable = zoomReadPlan !== undefined && truncation !== undefined && !isShowingAll;
  const zoomRead = useZoomRead({
    ...(zoomReadPlan ?? NO_ZOOM_READ),
    experimentId,
    tableName: visualization.dataConfig.tableName,
    filters,
    window: ranges.x,
    enabled: isZoomReadable,
  });
  const drawnRows = isZoomReadable && zoomRead.rows ? zoomRead.rows : rows;

  // KEEP IN SYNC with field reads in `transformCartesianData` and its helpers.
  // Re-derive: `grep -oE 'chartConfig\\.[a-zA-Z_]+' cartesian-transform.ts | sort -u`.
  const { chartSeries, subplots, useIndexForX } = useMemo(() => {
    return transformCartesianData(drawnRows, dataSources, chartConfig, {
      defaultTraceType,
      supportsContinuousColor,
      supportsSize,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    drawnRows,
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

  const positions = useMemo(
    () => chartSeries.map((series) => series.x.map(axisPosition)),
    [chartSeries],
  );
  const isSharedX = subplots?.sharedX === true;
  const reduction = useMemo(
    () =>
      isShowingAll
        ? { series: chartSeries, isReduced: false }
        : reduceSeries(chartSeries, positions, (series) => rangeFor(series, ranges, isSharedX)),
    [chartSeries, positions, ranges, isSharedX, isShowingAll],
  );

  const isDrawingZoomRead = isZoomReadable && zoomRead.rows !== undefined;
  const resolution: ChartResolution = {
    isReduced: reduction.isReduced || (isDrawingZoomRead && zoomRead.isBucketed),
    isShowingAll,
    total: isDrawingZoomRead ? (zoomRead.total ?? rows.length) : rows.length,
    onToggle: toggleShowingAll,
  };

  // Each gl chart holds scarce browser contexts, so only charts drawing many
  // markers earn them: SVG makes an element per marker, but a line is one path
  // however long it is. Nothing in the UI sets `useWebGL` and every chart
  // type's defaults store `false`, so only an explicit `true` counts as a choice.
  const markerCount = reduction.series.reduce(
    (sum, s) => sum + (drawsMarkers(s) ? s.y.length : 0),
    0,
  );
  const isLargeChart = markerCount > WEBGL_MARKER_THRESHOLD;

  const effectiveConfig: PlotlyChartConfig = useMemo(
    () => ({
      ...chartConfig,
      xAxisType: useIndexForX ? "linear" : chartConfig.xAxisType,
      useWebGL: chartConfig.useWebGL === true || isLargeChart,
    }),
    [chartConfig, useIndexForX, isLargeChart],
  );

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={rows.length > 0}
      truncation={isDrawingZoomRead ? undefined : truncation}
      resolution={resolution}
    >
      <div className="flex h-full w-full flex-col">
        <CartesianChart
          data={reduction.series}
          config={effectiveConfig}
          subplots={subplots}
          uirevision={`${visualization.id}:${xColumn ?? ""}`}
          onRelayout={onRelayout}
        />
      </div>
    </ChartFrame>
  );
}

/** Scatter series draw markers unless told otherwise; lines and areas only when asked. */
function drawsMarkers(series: CartesianSeries): boolean {
  const mode = series.mode ?? (series.traceType === "scatter" ? "markers" : "lines");
  return mode.includes("markers");
}

/** A series follows its own axis's zoom, or on a grid sharing its x axis, any cell's. */
function rangeFor(
  series: CartesianSeries,
  ranges: AxisRanges,
  isSharedX: boolean,
): AxisRange | undefined {
  const own = ranges[series.xaxisId ?? "x"];
  return own ?? (isSharedX ? Object.values(ranges)[0] : undefined);
}
