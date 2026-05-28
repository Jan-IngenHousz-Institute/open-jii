"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries, ErrorBarConfig, LineConfig, MarkerConfig } from "./types";
import { facetTierStyles, useChartSizing } from "./use-is-compact";
import {
  applyReferenceLines,
  createBaseLayout,
  createPlotlyConfig,
  extendLayoutForFacets,
  getPlotType,
  getRenderer,
  refineAxisType,
} from "./utils";

/**
 * One data series on a shared cartesian canvas. Visual encoding lives on
 * the series itself so a single chart can mix `line` + `bar` + `area`
 * traces. `axis: "secondary"` routes to a twin Y axis (`yaxis2`).
 */
export interface CartesianSeries extends BaseSeries {
  traceType: "line" | "bar" | "scatter" | "area";
  axis?: "primary" | "secondary";
  /**
   * Direct subplot routing (Plotly axis IDs like `"x"`, `"x2"`, `"x3"`).
   * When set, takes precedence over `axis: "primary" | "secondary"`.
   * Faceted charts use these to pin each trace to its cell.
   */
  xaxisId?: string;
  yaxisId?: string;
  // `null` entries mark missing cells (NULL in the row, column not in
  // the SQL projection, etc.). Plotly skips them rather than coercing
  // to a category tick, which is what we want for sparse/transitional
  // data.
  x: (string | number | Date | null)[];
  y: (string | number | null)[];

  mode?: "lines" | "markers" | "lines+markers" | "text" | "none";
  line?: LineConfig;
  marker?: MarkerConfig;
  fill?: "none" | "tozeroy" | "tozerox" | "tonexty" | "tonextx" | "toself" | "tonext";
  fillcolor?: string;
  connectgaps?: boolean;
  stackgroup?: string;
  groupnorm?: "" | "fraction" | "percent";

  // Bar-only. `"h"` flips the trace to horizontal bars; the trace builder
  // swaps `x` / `y` so the caller keeps the natural (categories, values)
  // mental model regardless of orientation.
  orientation?: "v" | "h";

  // Bubble sizing; only honoured when `traceType` is `"scatter"` and
  // `marker.size` is an array. `sizeref` is the derived scaling factor.
  sizemode?: "area" | "diameter";
  sizeref?: number;
  sizemin?: number;

  text?: string | string[];
  textposition?:
    | "top left"
    | "top center"
    | "top right"
    | "middle left"
    | "middle center"
    | "middle right"
    | "bottom left"
    | "bottom center"
    | "bottom right"
    | "inside"
    | "outside"
    | "auto"
    | "none";
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };

  error_x?: ErrorBarConfig;
  error_y?: ErrorBarConfig;
}

/**
 * One cell of a facet grid. The renderer builds N of these and stamps
 * each cell's `xaxisId` / `yaxisId` onto the corresponding traces.
 */
export interface FacetCell {
  /** Title rendered above the cell; usually the facet column's value. */
  title: string;
  /** Plotly axis ID this cell's traces are pinned to (e.g. `"x2"`). */
  xaxisId: string;
  /** Plotly axis ID for this cell's Y axis (e.g. `"y2"`). */
  yaxisId: string;
}

export interface FacetGridConfig {
  /** Number of rows in the grid. */
  rows: number;
  /** Number of columns. */
  columns: number;
  /**
   * Cells in row-major order, length = rows × columns. Empty trailing
   * cells (when N facets < rows × columns) are still listed with empty
   * titles so axis IDs stay stable.
   */
  cells: FacetCell[];
  /**
   * Share X-axis range / ticks across cells. When true, every xaxisN
   * is `matches: "x"` and tick labels are hidden on cells that aren't
   * in the bottom row.
   */
  sharedX?: boolean;
  /** Share Y-axis range / ticks across cells. */
  sharedY?: boolean;
  /**
   * Render a single shared X-axis title centred below the whole grid
   * instead of repeating it on every bottom-row cell. Independent of
   * `sharedX`: the title can be shared even when each cell has its
   * own range.
   */
  sharedXTitle?: boolean;
  /** Render a single shared Y-axis title centred left of the grid. */
  sharedYTitle?: boolean;
  /**
   * Plotly's `grid.roworder` flag. `"top to bottom"` (default) reads
   * like text; `"bottom to top"` flips for layouts where the natural
   * reading direction is upward.
   */
  roworder?: "top to bottom" | "bottom to top";
}

export interface CartesianChartProps extends BaseChartProps {
  data: CartesianSeries[];
  /**
   * Optional facet grid spec. When present, traces are routed to the
   * cells via their `xaxisId` / `yaxisId` and the layout emits a
   * `grid` block plus per-cell axis configs + cell-title annotations.
   * When absent, the chart renders as a single canvas (existing path).
   */
  subplots?: FacetGridConfig;
}

/**
 * Mixed-trace cartesian renderer. Emits one Plotly trace per
 * `CartesianSeries`, with the trace `type` driven by the series' own
 * `traceType`. When any series targets the secondary axis a `yaxis2` is
 * composed alongside the primary.
 */
export function CartesianChart({
  data,
  config = {},
  className,
  loading,
  error,
  subplots,
  ...eventHandlers
}: CartesianChartProps) {
  // Faceted charts pass their grid so the sizing tier compares against
  // per-cell area (a 4x2 grid in an 800x500 box has ~200x250 cells).
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>(
    subplots ? { grid: { rows: subplots.rows, columns: subplots.columns } } : {},
  );
  const renderer = getRenderer(config.useWebGL);
  const scatterPlotType = getPlotType("scatter", renderer);

  const plotData: PlotData[] = data.map((series) => buildTrace(series, scatterPlotType));

  const layout = createBaseLayout(config, sizing);

  // For axis-type detection use the values Plotly actually puts on each
  // axis. Horizontal bars swap x/y in `buildTrace`, so their X-axis
  // values come from `series.y`.
  const xAxisValues = data.flatMap((s) => (s.orientation === "h" ? (s.y ?? []) : (s.x ?? [])));
  const primaryYValues = data
    .filter((s) => s.axis !== "secondary")
    .flatMap((s) => (s.orientation === "h" ? (s.x ?? []) : (s.y ?? [])));

  layout.xaxis = refineAxisType(layout.xaxis, xAxisValues);
  layout.yaxis = refineAxisType(layout.yaxis, primaryYValues);

  // Bar-layout fields live on the layout, not on individual traces. Plotly
  // ignores them when no bar trace is present, so always passing them
  // through is harmless for line/scatter/area-only charts.
  if (config.barmode !== undefined) (layout as Record<string, unknown>).barmode = config.barmode;
  if (config.barnorm !== undefined) (layout as Record<string, unknown>).barnorm = config.barnorm;
  if (config.bargap !== undefined) (layout as Record<string, unknown>).bargap = config.bargap;
  if (config.bargroupgap !== undefined)
    (layout as Record<string, unknown>).bargroupgap = config.bargroupgap;

  // Defensive: when any bar series is horizontal Plotly's auto-detection
  // sometimes leaves the category axis on `linear`, which renders the
  // category strings as if they were numbers. Force `category` to match
  // what `BarChart` did before the migration.
  const hasHorizontalBars = data.some((s) => s.traceType === "bar" && s.orientation === "h");
  if (hasHorizontalBars) {
    layout.yaxis = { ...layout.yaxis, type: "category" };
  }

  // Faceted layout: convert the single-canvas xaxis/yaxis into a grid of
  // numbered axes + per-cell title annotations. Done before secondary-Y
  // composition because secondary axes don't compose with facets in v1
  // (the `extendLayoutForFacets` helper skips yaxis2 entirely).
  if (subplots) {
    const { cellTitleFontSize } = facetTierStyles(sizing);
    // At very/ultra-compact cell tiers force shared axis titles
    // regardless of the user's toggle.
    const forceSharedTitles = sizing.cellVeryCompact;
    const effectiveSharedXTitle = forceSharedTitles || subplots.sharedXTitle === true;
    const effectiveSharedYTitle = forceSharedTitles || subplots.sharedYTitle === true;
    const faceted = extendLayoutForFacets(layout, subplots.cells, {
      rows: subplots.rows,
      columns: subplots.columns,
      sharedX: subplots.sharedX,
      sharedY: subplots.sharedY,
      sharedXTitle: effectiveSharedXTitle,
      sharedYTitle: effectiveSharedYTitle,
      roworder: subplots.roworder,
      titleFontSize: cellTitleFontSize,
    });
    Object.assign(layout, faceted);
  }

  const hasSecondary = data.some((s) => s.axis === "secondary");
  if (hasSecondary && !subplots) {
    const secondaryYValues = data.filter((s) => s.axis === "secondary").flatMap((s) => s.y ?? []);
    // Mirror tick/line styling from primary so the two axes look like a
    // matched pair rather than two unrelated widgets. The primary slice
    // was built by `createBaseLayout` above.
    const primary = (layout.yaxis ?? {}) as Record<string, unknown>;
    const titleFont = (primary.title as { font?: unknown } | undefined)?.font;

    const baseY2: Record<string, unknown> = {
      title: config.y2AxisTitle ? { text: config.y2AxisTitle, font: titleFont } : undefined,
      overlaying: "y",
      side: "right",
      type: config.y2AxisType ?? "linear",
      // Hide secondary grid; doubling makes the plot area look striped.
      showgrid: false,
      automargin: true,
      tickfont: primary.tickfont,
      color: primary.color,
      linecolor: primary.linecolor,
      tickcolor: primary.tickcolor,
      showline: true,
    };
    // Auto-detect type only when the user didn't pin one. `Layout` has
    // no `yaxis2` field; Plotly accepts arbitrary `yaxisN` keys.
    const refined = config.y2AxisType ? baseY2 : refineAxisType(baseY2, secondaryYValues);
    (layout as unknown as Record<string, unknown>).yaxis2 = refined;
  }

  // Reference-line overlays sit on top of everything else in the layout;
  // applied last so prior steps (facets, secondary axis) can populate
  // `layout.shapes` / `layout.annotations` without conflict.
  applyReferenceLines(layout, config.referenceLines, { cells: subplots?.cells });

  const plotConfig = createPlotlyConfig(config, sizing);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        data={plotData}
        layout={layout}
        config={plotConfig}
        loading={loading}
        error={error}
        {...eventHandlers}
      />
    </div>
  );
}

/**
 * Translate one typed series into a Plotly trace. Switching on `traceType`
 * here (rather than parameterising `LineChart`/`BarChart` etc.) lets a
 * single chart hold mixed traces while keeping each branch readable.
 */
function buildTrace(series: CartesianSeries, scatterPlotType: string): PlotData {
  // Axis routing precedence: explicit `xaxisId` / `yaxisId` (faceted
  // charts pin each trace to its cell) wins over the legacy `axis:
  // "secondary"` flag (single-canvas dual-Y). When both are unset the
  // trace defaults to the implicit `x` / `y` pair Plotly assigns.
  const yaxisRouting =
    series.yaxisId !== undefined
      ? { yaxis: series.yaxisId }
      : series.axis === "secondary"
        ? { yaxis: "y2" as const }
        : {};
  const xaxisRouting = series.xaxisId !== undefined ? { xaxis: series.xaxisId } : {};

  const baseShared = {
    x: series.x,
    y: series.y,
    name: series.name,
    opacity: series.opacity,
    visible: series.visible,
    showlegend: series.showlegend,
    legendgroup: series.legendgroup,
    hovertemplate: series.hovertemplate,
    hoverinfo: series.hoverinfo,
    customdata: series.customdata,
    text: series.text,
    textposition: series.textposition,
    textfont: series.textfont,
    ...xaxisRouting,
    ...yaxisRouting,
  };

  if (series.traceType === "bar") {
    // Bars don't honour `mode` / `line` / `fill` / `connectgaps`. For
    // horizontal bars Plotly expects `x` as values and `y` as categories.
    const horizontal = series.orientation === "h";
    return {
      ...baseShared,
      x: horizontal ? series.y : series.x,
      y: horizontal ? series.x : series.y,
      type: "bar",
      orientation: series.orientation ?? "v",
      marker: {
        ...series.marker,
        color: series.marker?.color ?? series.color,
      },
      error_x: series.error_x,
      error_y: series.error_y,
    } as unknown as PlotData;
  }

  if (series.traceType === "scatter") {
    // Scatter (markers-only) by default; `mode: "lines+markers"` gives a
    // connected scatter.
    return {
      ...baseShared,
      type: scatterPlotType,
      mode: series.mode ?? "markers",
      marker: {
        color: series.marker?.color ?? series.color ?? "#1f77b4",
        size: series.marker?.size ?? 6,
        symbol: series.marker?.symbol ?? "circle",
        opacity: series.marker?.opacity ?? series.opacity ?? 1,
        colorscale: series.marker?.colorscale,
        showscale: series.marker?.showscale ?? false,
        colorbar: series.marker?.colorbar,
        line: series.marker?.line,
        // Bubble sizing; Plotly ignores these when `marker.size` is a
        // scalar.
        sizemode: series.sizemode,
        sizeref: series.sizeref,
        sizemin: series.sizemin,
      },
      line: series.mode?.includes("lines")
        ? {
            color: series.line?.color ?? series.color,
            width: series.line?.width ?? 2,
            dash: series.line?.dash ?? "solid",
            shape: series.line?.shape ?? "linear",
          }
        : undefined,
      error_x: series.error_x,
      error_y: series.error_y,
    } as unknown as PlotData;
  }

  // line + area share the scatter trace shape; area adds a fill default
  // and (optionally) a stack group.
  const isArea = series.traceType === "area";
  return {
    ...baseShared,
    type: scatterPlotType,
    mode: series.mode ?? "lines",
    line: {
      color: series.line?.color ?? series.color ?? "#1f77b4",
      width: series.line?.width ?? 2,
      dash: series.line?.dash ?? "solid",
      shape: series.line?.shape ?? "linear",
      smoothing: series.line?.smoothing,
    },
    marker:
      series.marker || series.mode?.includes("markers")
        ? {
            color: series.marker?.color ?? series.color,
            size: series.marker?.size ?? 6,
            symbol: series.marker?.symbol ?? "circle",
            opacity: series.marker?.opacity ?? series.opacity ?? 1,
            colorscale: series.marker?.colorscale,
            showscale: series.marker?.showscale ?? false,
            colorbar: series.marker?.colorbar,
            line: series.marker?.line,
          }
        : undefined,
    fill: series.fill ?? (isArea ? "tozeroy" : "none"),
    fillcolor: series.fillcolor,
    connectgaps: series.connectgaps !== false,
    stackgroup: series.stackgroup,
    groupnorm: series.groupnorm,
    error_x: series.error_x,
    error_y: series.error_y,
  } as unknown as PlotData;
}
