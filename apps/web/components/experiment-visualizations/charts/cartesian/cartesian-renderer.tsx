"use client";

import { CartesianChart } from "@/components/charts/cartesian-chart";
import { useColumnMetadata } from "@/hooks/experiment/useColumnMetadata/useColumnMetadata";
import { useTableRowCounts } from "@/hooks/experiment/useTableRowCounts/useTableRowCounts";
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
import { drawsFromBuckets, xScaleOf, zoomReadPlanOf } from "./zoom-read-plan";
import type { ZoomReadPlan } from "./zoom-read-plan";

interface CartesianRendererProps extends ChartRendererProps {
  defaultTraceType: ExperimentSeriesTraceType;
  supportsContinuousColor?: boolean;
  supportsSize?: boolean;
}

// Above this many markers or error bars SVG starts to jank and WebGL earns its context.
const WEBGL_POINT_MARK_THRESHOLD = 5000;

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

  const colorColumn = dataSources.find((ds) => ds.role === "color")?.columnName;
  const tableName = visualization.dataConfig.tableName;
  const { columns, isLoading: isColumnsLoading } = useColumnMetadata(experimentId, tableName);
  const colorColumnType = columns.find((c) => c.name === colorColumn)?.type_text;
  const xColumnType = columns.find((c) => c.name === xColumn)?.type_text;

  const rowCountOf = useTableRowCounts(experimentId);

  const chartConfig = narrowChartConfig(visualization);

  const [isShowingAll, setIsShowingAll] = useState(false);
  const toggleShowingAll = useCallback(() => setIsShowingAll((showing) => !showing), []);
  const { ranges, onRelayout } = useAxisRanges();

  // A long series is drawn from buckets of the whole table, decided from the table's row count
  // before any rows are read; until that count and the x column's type are in, nothing is read.
  const bucketDecision =
    providedData === undefined ? drawsFromBuckets(visualization, rowCountOf?.(tableName)) : false;
  const isBucketCandidate = bucketDecision === true && !isShowingAll;
  const isAwaitingDecision =
    bucketDecision === undefined || (isBucketCandidate && isColumnsLoading);
  // Buckets name their scale from the x column's type; a categorical x is read whole instead.
  const isBucketPath = isBucketCandidate && xScaleOf(xColumnType, [], xColumn) !== undefined;

  const chartData = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn,
    enabled: !isAwaitingDecision && !isBucketPath,
  });
  const { rows, isRefreshing, truncation, filters } = chartData;

  // A full read that came back truncated is drawn from buckets as well.
  const zoomReadPlan = useMemo(
    () =>
      zoomReadPlanOf(
        visualization.dataConfig,
        chartConfig,
        defaultTraceType,
        xScaleOf(xColumnType, rows, xColumn),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the plan reads only these of the config.
    [
      visualization.dataConfig,
      chartConfig.stackMode,
      chartConfig.facetSharedX,
      defaultTraceType,
      xColumnType,
      xColumn,
      rows,
    ],
  );
  const isZoomReadable =
    zoomReadPlan !== undefined && !isShowingAll && (isBucketPath || truncation !== undefined);
  const zoomRead = useZoomRead({
    ...(zoomReadPlan ?? NO_ZOOM_READ),
    experimentId,
    tableName,
    filters,
    // Bucketed facets share their x, so a zoom in any cell sets the window for all of them.
    window: ranges.x ?? Object.values(ranges)[0],
    enabled: isZoomReadable,
  });
  const drawnRows = isZoomReadable && zoomRead.rows ? zoomRead.rows : rows;

  const isLoading =
    isAwaitingDecision ||
    (isBucketPath ? zoomRead.rows === undefined && !zoomRead.error : chartData.isLoading);
  const error = isBucketPath ? zoomRead.error : chartData.error;

  // KEEP IN SYNC with field reads in `transformCartesianData` and its helpers.
  // Re-derive: `grep -oE 'chartConfig\\.[a-zA-Z_]+' cartesian-transform.ts | sort -u`.
  const { chartSeries, subplots, useIndexForX } = useMemo(() => {
    return transformCartesianData(drawnRows, dataSources, chartConfig, {
      defaultTraceType,
      supportsContinuousColor,
      supportsSize,
      colorColumnType,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    drawnRows,
    dataSources,
    defaultTraceType,
    supportsContinuousColor,
    supportsSize,
    colorColumnType,
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
  // markers or error bars earn them: SVG makes an element for each, but a line
  // is one path however long it is. Nothing in the UI sets `useWebGL` and every
  // chart type's defaults store `false`, so only an explicit `true` counts as a choice.
  const pointMarkCount = reduction.series.reduce(
    (sum, s) => sum + (drawsPointMarks(s) ? s.y.length : 0),
    0,
  );
  const isLargeChart = pointMarkCount > WEBGL_POINT_MARK_THRESHOLD;

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
      isRefreshing={isRefreshing}
      error={error}
      hasRows={drawnRows.length > 0}
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

/**
 * Whether a series draws a mark per point that WebGL would spare: markers, which scatter series draw
 * unless told otherwise and lines only when asked, or error bars. Bars are never drawn on WebGL.
 */
function drawsPointMarks(series: CartesianSeries): boolean {
  if (series.traceType === "bar") {
    return false;
  }
  const mode = series.mode ?? (series.traceType === "scatter" ? "markers" : "lines");
  const hasErrorBars = [series.error_x, series.error_y].some(
    (bar) => bar !== undefined && bar.visible !== false,
  );
  return mode.includes("markers") || hasErrorBars;
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
