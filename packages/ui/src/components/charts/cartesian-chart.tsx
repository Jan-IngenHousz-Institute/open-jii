"use client";

import type { ColorBar, Layout, PlotData, PlotRelayoutEvent } from "plotly.js";
import React, { useMemo } from "react";

import { cn } from "../../lib/utils";
import {
  chartTextWidth,
  HORIZONTAL_LEGEND_HEIGHT,
  LEGEND_PADDING,
  withBoundedHorizontalLegend,
  withBoundedRightLegend,
} from "./outer-labels";
import { PlotlyChart } from "./plotly-chart";
import type {
  BaseChartProps,
  BaseSeries,
  ErrorBarConfig,
  LineConfig,
  MarkerConfig,
  PlotlyChartConfig,
} from "./types";
import { useChartThemeRefresh } from "./use-chart-theme-refresh";
import { facetTierStyles, useChartSizing } from "./use-is-compact";
import {
  applyAxisType,
  applyReferenceLines,
  createBaseLayout,
  createPlotlyConfig,
  detectAxisType,
  effectiveLegendPosition,
  extendLayoutForFacets,
  getPlotType,
  getRenderer,
  refineAxisType,
  SHARED_FACET_Y_TITLE_GUTTER,
  tierAxisFontSizes,
  truncateCategoryTicks,
  cellPosition,
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
  /**
   * Plotly axis ID for this cell's overlay (secondary) Y axis, when the
   * chart has a secondary-axis Y series. The renderer emits a matching
   * `yaxisN` that overlays `yaxisId` on the right side of the cell.
   */
  secondaryYaxisId?: string;
}

export interface FacetGridConfig {
  /** Number of rows in the grid. */
  rows: number;
  /** Number of columns. */
  columns: number;
  /**
   * One cell per facet in row-major order; omit unused trailing grid positions.
   * A listed cell remains occupied even when its title or plotted data is empty.
   * An empty title suppresses the heading; it does not mark a padding cell.
   */
  cells: FacetCell[];
  /**
   * Share X-axis range / ticks across cells. When true, every xaxisN
   * is `matches: "x"` and tick labels appear on the visually lowest
   * listed cell in each column.
   */
  sharedX?: boolean;
  /** Share Y-axis range / ticks across cells. */
  sharedY?: boolean;
  /**
   * Render a single shared X-axis title centred below the whole grid
   * instead of repeating it on each column's lowest cell. Independent of
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

export type CartesianColorAxis = Pick<MarkerConfig, "colorscale" | "showscale"> & {
  colorbar?: Partial<ColorBar>;
};

const FACET_HEADING_OFFSET = 4;
// The shared X title is drawn 50 px below the plot, plus a line of text and padding.
const FACET_X_TITLE_BAND = 72;
const DEFAULT_FACET_COLUMN_GAP = 0.2;

function estimateFacetedPlotWidth(
  width: number,
  sharedYTitle: boolean,
  secondaryTitle: string | undefined,
  colorbar: CartesianColorAxis["colorbar"],
): number {
  const primaryGutter = sharedYTitle ? SHARED_FACET_Y_TITLE_GUTTER : 56;
  const secondaryGutter = secondaryTitle ? 64 : 48;
  const title = colorbar?.title;
  const rightTitleWidth = title?.text && title.side === "right" ? 24 : 0;
  const horizontalTitleWidth =
    title?.text && title.side !== "right"
      ? chartTextWidth(title.text, title.font?.size ?? 14) + 24
      : 0;
  const colorbarGutter = Math.max(
    (colorbar?.thickness ?? 30) + 56 + rightTitleWidth,
    horizontalTitleWidth,
  );
  return width - primaryGutter - secondaryGutter - colorbarGutter;
}

function independentFacetGap(plotWidth: number, columns: number, tickSize: number): number {
  const tickGap = 2 * chartTextWidth("0,000", tickSize) + 12;
  // Only widen the inner tick gutters when each panel can keep at least 60 px of plot.
  if (plotWidth < 60 * columns + tickGap * (columns - 1)) return DEFAULT_FACET_COLUMN_GAP;
  // Plotly converts the gap fraction to pixels as plotWidth * gap / (columns - gap).
  return Math.max(DEFAULT_FACET_COLUMN_GAP, (tickGap * columns) / (plotWidth + tickGap));
}

export interface CartesianChartProps extends BaseChartProps {
  data: CartesianSeries[];
  /** Continuous scatter marker scale, shared when the chart has multiple traces. */
  colorAxis?: CartesianColorAxis;
  /**
   * Optional facet grid spec. When present, traces are routed to the
   * cells via their `xaxisId` / `yaxisId` and the layout emits a
   * `grid` block plus per-cell axis configs + cell-title annotations.
   * When absent, the chart renders as a single canvas (existing path).
   */
  subplots?: FacetGridConfig;
  /** While this stays the same, a redraw keeps the user's zoom and pan. */
  uirevision?: string;
  /** Called when the user zooms, pans or resets the view, with the layout keys that changed. */
  onRelayout?: (event: Readonly<Record<string, unknown>>) => void;
}

/**
 * Mixed-trace cartesian renderer. Emits one Plotly trace per
 * `CartesianSeries`, with the trace `type` driven by the series' own
 * `traceType`. When any series targets the secondary axis a `yaxis2` is
 * composed alongside the primary.
 */
export function CartesianChart({
  data,
  colorAxis,
  config = {},
  className,
  loading,
  error,
  subplots,
  uirevision,
  onRelayout,
  ...eventHandlers
}: CartesianChartProps) {
  // Faceted charts pass their grid so the sizing tier compares against
  // per-cell area (a 4x2 grid in an 800x500 box has ~200x250 cells).
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>({
    trackWidth: true,
    trackHeight:
      !config.height &&
      subplots?.sharedY === false &&
      subplots.rows > 1 &&
      Boolean(config.y2AxisTitle),
    ...(subplots ? { grid: { rows: subplots.rows, columns: subplots.columns } } : {}),
  });
  const themeVersion = useChartThemeRefresh();
  const renderer = getRenderer(config.useWebGL);
  const scatterPlotType = getPlotType("scatter", renderer);

  const traceColorScale = data.length === 1 ? colorAxis : undefined;
  const sharedColorAxis = traceColorScale ? undefined : colorAxis;
  const hasSharedColorAxis = sharedColorAxis !== undefined;
  const plotData: PlotData[] = useMemo(
    () =>
      data.map((series) =>
        buildTrace(series, scatterPlotType, hasSharedColorAxis, traceColorScale),
      ),
    [data, scatterPlotType, hasSharedColorAxis, traceColorScale],
  );

  // Keyed on the data alone: the layout below also rebuilds on a tier flip and
  // a theme change, neither of which can alter an axis kind. Horizontal bars
  // swap x/y in `buildTrace`, so their X values come from `series.y`.
  const axisScan = useMemo(() => {
    const x = data.flatMap((s) => (s.orientation === "h" ? (s.y ?? []) : (s.x ?? [])));
    const y = data
      .filter((s) => s.axis !== "secondary")
      .flatMap((s) => (s.orientation === "h" ? (s.x ?? []) : (s.y ?? [])));
    return { x, y, xType: detectAxisType(x), yType: detectAxisType(y) };
  }, [data]);

  const { layout, boundHorizontalLegend } = useMemo(() => {
    const hasSecondary = data.some((series) => series.axis === "secondary");
    const hasOuterColorbar = hasSecondary && sharedColorAxis?.showscale === true;
    const chartWidth = config.width || sizing.width || 720;
    const legendTraces = hasOuterColorbar
      ? data.filter((series) => series.visible !== false && series.showlegend !== false)
      : [];
    const showLegend = config.showLegend !== false && legendTraces.length > 0;
    const requestedLegend = config.legendPosition ?? "right";
    const sharedYTitle = sizing.cellVeryCompact || subplots?.sharedYTitle === true;
    const showSharedYTitle = sharedYTitle && !sizing.cellUltraCompact;
    const facetPlotWidth =
      hasOuterColorbar && subplots
        ? estimateFacetedPlotWidth(
            chartWidth,
            showSharedYTitle,
            config.y2AxisTitle,
            sharedColorAxis.colorbar,
          )
        : Infinity;
    const independentColumns = subplots?.sharedY === false ? subplots.columns : 1;
    const columnGap =
      hasOuterColorbar && independentColumns > 1
        ? independentFacetGap(
            facetPlotWidth,
            independentColumns,
            tierAxisFontSizes({
              snug: sizing.cellSnug,
              compact: sizing.cellCompact,
              veryCompact: sizing.cellVeryCompact,
            }).tick,
          )
        : DEFAULT_FACET_COLUMN_GAP;
    // An inside legend must also clear the interior Y ticks of a panel on an independent scale.
    const insidePlotWidth = (facetPlotWidth * (1 - columnGap)) / (independentColumns - columnGap);
    const longestLegendName = Math.max(
      0,
      ...legendTraces.map((series) => chartTextWidth(series.name ?? "", 12)),
    );
    const wideLeftLegend =
      requestedLegend === "left" &&
      (sizing.compact ||
        longestLegendName > chartWidth / 4 ||
        Boolean(subplots && showSharedYTitle && config.yAxisTitle));
    const wideInsideLegend =
      showLegend &&
      subplots &&
      requestedLegend.startsWith("inside-") &&
      longestLegendName + LEGEND_PADDING > insidePlotWidth * 0.96;
    // Plotly's container margins can squeeze the colour bar when both side gutters are occupied.
    const legendConfig =
      hasOuterColorbar &&
      showLegend &&
      (requestedLegend === "right" || wideLeftLegend || wideInsideLegend)
        ? { ...config, legendPosition: "bottom" as const }
        : config;
    const tiers = {
      ...sizing,
      hasSecondaryAxis: hasSecondary,
      hasColorbar: colorAxis?.showscale || data.some((series) => series.marker?.showscale),
    };
    const legendPosition = showLegend ? effectiveLegendPosition(legendConfig, tiers) : undefined;
    const topLegend = legendPosition === "top";
    const bottomLegend = legendPosition === "bottom";
    const next: Partial<Layout> & { coloraxis?: CartesianColorAxis } = createBaseLayout(
      legendConfig,
      tiers,
    );
    if (sharedColorAxis) {
      next.coloraxis = hasOuterColorbar
        ? { ...sharedColorAxis, colorbar: { ...sharedColorAxis.colorbar, xref: "container" } }
        : sharedColorAxis;
    }
    if (hasOuterColorbar && next.title) {
      next.title = { ...next.title, xref: "paper", x: 0.5 };
    }

    const xAxisValues = axisScan.x;
    const primaryYValues = axisScan.y;

    next.xaxis = applyAxisType(next.xaxis, axisScan.xType);
    next.yaxis = applyAxisType(next.yaxis, axisScan.yType);

    // Bar-layout fields live on the layout, not on individual traces. Plotly
    // ignores them when no bar trace is present, so always passing them
    // through is harmless for line/scatter/area-only charts.
    if (config.barmode !== undefined) (next as Record<string, unknown>).barmode = config.barmode;
    if (config.barnorm !== undefined) (next as Record<string, unknown>).barnorm = config.barnorm;
    if (config.bargap !== undefined) (next as Record<string, unknown>).bargap = config.bargap;
    if (config.bargroupgap !== undefined)
      (next as Record<string, unknown>).bargroupgap = config.bargroupgap;

    // Defensive: when any bar series is horizontal Plotly's auto-detection
    // sometimes leaves the category axis on `linear`, which renders the
    // category strings as if they were numbers. Force `category` to match
    // what `BarChart` did before the migration.
    const hasHorizontalBars = data.some((s) => s.traceType === "bar" && s.orientation === "h");
    if (hasHorizontalBars) {
      next.yaxis = { ...next.yaxis, type: "category" };
    }

    // Truncate long category ticks before facets so cells inherit them.
    next.xaxis = truncateCategoryTicks(next.xaxis ?? {}, xAxisValues, sizing);
    next.yaxis = truncateCategoryTicks(next.yaxis ?? {}, primaryYValues, sizing);

    // Faceted layout: convert the single-canvas xaxis/yaxis into a grid of
    // numbered axes + per-cell title annotations. Runs before the secondary-Y
    // step so the overlay axes can borrow each cell's primary styling.
    if (subplots) {
      const { cellTitleFontSize } = facetTierStyles(sizing);
      // At very/ultra-compact cell tiers force shared axis titles
      // regardless of the user's toggle.
      const forceSharedTitles = sizing.cellVeryCompact;
      const effectiveSharedXTitle = forceSharedTitles || subplots.sharedXTitle === true;
      const faceted = extendLayoutForFacets(next, subplots.cells, {
        rows: subplots.rows,
        columns: subplots.columns,
        sharedX: subplots.sharedX,
        sharedY: subplots.sharedY,
        sharedXTitle: effectiveSharedXTitle,
        sharedYTitle,
        roworder: subplots.roworder,
        titleFontSize: cellTitleFontSize,
        ...(hasOuterColorbar ? { cellTitleOffset: FACET_HEADING_OFFSET } : {}),
        ultraCompactCells: sizing.cellUltraCompact,
      });
      Object.assign(next, faceted);
      if (hasOuterColorbar) {
        if (columnGap > DEFAULT_FACET_COLUMN_GAP && next.grid) {
          next.grid = { ...next.grid, xgap: columnGap };
        }
        const topLegendBand = topLegend ? HORIZONTAL_LEGEND_HEIGHT : 0;
        const titleBand = next.title ? (next.title.font?.size ?? 14) * 1.5 + 12 : 0;
        const panelBand =
          !sizing.cellUltraCompact && subplots.cells.some((cell) => cell.title)
            ? cellTitleFontSize * 1.5 + FACET_HEADING_OFFSET
            : 0;
        const bottomBand =
          bottomLegend && !sizing.cellUltraCompact && effectiveSharedXTitle && config.xAxisTitle
            ? HORIZONTAL_LEGEND_HEIGHT + FACET_X_TITLE_BAND
            : 0;
        if (next.title) {
          next.title = {
            ...next.title,
            yref: "container",
            y: 1,
            yanchor: "top",
            pad: { t: topLegendBand + 8 },
          };
        }
        next.margin = {
          ...next.margin,
          t: Math.max(next.margin?.t ?? 0, Math.ceil(topLegendBand + titleBand + panelBand)),
          b: Math.max(next.margin?.b ?? 0, bottomBand),
        };
      }
    }

    if (hasSecondary && subplots) {
      // Faceted dual-Y: one overlay axis per cell, built after the grid so it
      // can borrow each cell's primary styling and overlay its y-domain.
      applyFacetSecondaryAxes(next, data, subplots, config, config.height || sizing.height);
    } else if (hasSecondary) {
      const secondaryYValues = data.filter((s) => s.axis === "secondary").flatMap((s) => s.y ?? []);
      // Mirror tick/line styling from primary so the two axes look like a
      // matched pair rather than two unrelated widgets. The primary slice
      // was built by `createBaseLayout` above.
      const primary = (next.yaxis ?? {}) as Record<string, unknown>;
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
      (next as unknown as Record<string, unknown>).yaxis2 = refined;
    }

    // Reference-line overlays sit on top of everything else in the layout;
    // applied last so prior steps (facets, secondary axis) can populate
    // `layout.shapes` / `layout.annotations` without conflict.
    applyReferenceLines(next, config.referenceLines, { cells: subplots?.cells });

    if (uirevision !== undefined) {
      next.uirevision = uirevision;
    }

    return { layout: next, boundHorizontalLegend: topLegend || bottomLegend };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
  }, [
    config,
    sizing,
    data,
    axisScan,
    colorAxis,
    sharedColorAxis,
    subplots,
    uirevision,
    themeVersion,
  ]);

  const bounded = useMemo(
    () =>
      boundHorizontalLegend
        ? withBoundedHorizontalLegend(layout, plotData, config.width || sizing.width || 720)
        : withBoundedRightLegend(layout, config, plotData, sizing.width),
    [boundHorizontalLegend, layout, config, plotData, sizing.width],
  );
  const plotConfig = useMemo(() => createPlotlyConfig(config, sizing), [config, sizing]);
  const handleRelayout = React.useCallback(
    (event: Readonly<PlotRelayoutEvent>) => onRelayout?.({ ...event }),
    [onRelayout],
  );

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        data={bounded.data}
        layout={bounded.layout}
        config={plotConfig}
        loading={loading}
        error={error}
        onRelayout={onRelayout ? handleRelayout : undefined}
        {...eventHandlers}
      />
    </div>
  );
}

/**
 * Faceted dual-Y: for every cell with a secondary series, emit an overlay
 * `yaxisN` that shares the cell's y-domain (`overlaying`) and hangs its ticks
 * on the right. Mirrors the single-canvas secondary styling per cell. When the
 * Y scale is shared, or repeated titles would collide, the rightmost panels
 * use one title. Independent axes still keep their own ticks and ranges.
 */
function applyFacetSecondaryAxes(
  layout: Partial<Layout>,
  data: CartesianSeries[],
  subplots: FacetGridConfig,
  config: PlotlyChartConfig,
  chartHeight?: number,
): void {
  const layoutRecord = layout as unknown as Record<string, unknown>;
  const firstSecondaryId = subplots.cells.find((c) => c.secondaryYaxisId)?.secondaryYaxisId;
  const sharedY = subplots.sharedY !== false;
  const rightEdge = subplots.cells.filter(
    (cell, index) =>
      cell.secondaryYaxisId && cellPosition(index, subplots.rows, subplots.columns).isLastColumn,
  );
  const plotHeight = (chartHeight ?? Infinity) - (layout.margin?.t ?? 0) - (layout.margin?.b ?? 0);
  // Plotly's independent grid spaces row centres by plotHeight / (rows - ygap).
  const rowSpacing = plotHeight / (subplots.rows - (layout.grid?.ygap ?? 0.3));
  // Plotly defaults an axis title to 120% of the layout font, rounded to a pixel.
  const captionSpan = chartTextWidth(
    config.y2AxisTitle ?? "",
    Math.round((layout.font?.size ?? 12) * 1.2),
  );
  const useColumnTitle = sharedY || (rightEdge.length > 1 && captionSpan + 4 > rowSpacing);
  // On an even stack, use the middle panel nearer the larger margin so the rotated title can fit.
  const preferBottom = (layout.margin?.b ?? 0) > (layout.margin?.t ?? 0);
  const bottomFirst = subplots.roworder === "bottom to top";
  const middleRow =
    preferBottom === bottomFirst
      ? Math.floor((rightEdge.length - 1) / 2)
      : Math.floor(rightEdge.length / 2);
  const columnTitleId = rightEdge[middleRow]?.secondaryYaxisId;

  subplots.cells.forEach((cell, i) => {
    const secondaryId = cell.secondaryYaxisId;
    if (!secondaryId) {
      return;
    }
    const { isLastColumn } = cellPosition(i, subplots.rows, subplots.columns);
    const primaryKey = cell.yaxisId === "y" ? "yaxis" : `yaxis${cell.yaxisId.slice(1)}`;
    const primary = (layoutRecord[primaryKey] ?? {}) as Record<string, unknown>;
    const secondaryValues = data.filter((s) => s.yaxisId === secondaryId).flatMap((s) => s.y);

    const base: Record<string, unknown> = {
      overlaying: cell.yaxisId,
      anchor: cell.xaxisId,
      side: "right",
      type: config.y2AxisType ?? "linear",
      showgrid: false,
      automargin: true,
      tickfont: primary.tickfont,
      color: primary.color,
      linecolor: primary.linecolor,
      tickcolor: primary.tickcolor,
      showline: true,
      showticklabels: sharedY ? isLastColumn : true,
      title:
        isLastColumn && config.y2AxisTitle && (!useColumnTitle || secondaryId === columnTitleId)
          ? { text: config.y2AxisTitle }
          : undefined,
      matches: sharedY && secondaryId !== firstSecondaryId ? firstSecondaryId : undefined,
    };
    const key = `yaxis${secondaryId.slice(1)}`;
    layoutRecord[key] = config.y2AxisType ? base : refineAxisType(base, secondaryValues);
  });
}

/**
 * Translate one typed series into a Plotly trace. Switching on `traceType`
 * here (rather than parameterising `LineChart`/`BarChart` etc.) lets a
 * single chart hold mixed traces while keeping each branch readable.
 */
function buildTrace(
  series: CartesianSeries,
  scatterPlotType: string,
  hasSharedColorAxis: boolean,
  traceColorScale?: CartesianColorAxis,
): PlotData {
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
        color: series.marker?.color ?? series.color,
        size: series.marker?.size ?? 6,
        symbol: series.marker?.symbol ?? "circle",
        opacity: series.marker?.opacity ?? series.opacity ?? 1,
        ...(hasSharedColorAxis
          ? { coloraxis: "coloraxis" }
          : (traceColorScale ?? {
              colorscale: series.marker?.colorscale,
              showscale: series.marker?.showscale ?? false,
              colorbar: series.marker?.colorbar,
            })),
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
      color: series.line?.color ?? series.color,
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
    // Plotly's stackgroup-implies-tonexty default doesn't render in
    // plotly.js v3; set it explicitly.
    fill: series.fill ?? (series.stackgroup ? "tonexty" : isArea ? "tozeroy" : "none"),
    fillcolor: series.fillcolor,
    connectgaps: series.connectgaps !== false,
    stackgroup: series.stackgroup,
    groupnorm: series.groupnorm,
    error_x: series.error_x,
    error_y: series.error_y,
  } as unknown as PlotData;
}
