"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import type { FacetGridConfig } from "./cartesian-chart";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries } from "./types";
import { useChartSizing, facetTierStyles } from "./use-is-compact";
import {
  applyReferenceLines,
  createBaseLayout,
  createPlotlyConfig,
  extendLayoutForFacets,
  getRenderer,
  getPlotType,
} from "./utils";

export interface HistogramSeriesData extends BaseSeries {
  x?: (string | number | Date)[];
  y?: (string | number)[];
  /**
   * Facet routing: when set, pins the trace to a specific subplot cell's
   * axes (`"x"`, `"x2"`, ...). Unset uses Plotly's implicit `x`/`y` pair.
   */
  xaxisId?: string;
  yaxisId?: string;
  nbinsx?: number;
  nbinsy?: number;
  xbins?: {
    start?: number;
    end?: number;
    size?: number;
  };
  ybins?: {
    start?: number;
    end?: number;
    size?: number;
  };
  autobinx?: boolean;
  autobiny?: boolean;
  bingroup?: string;
  orientation?: "v" | "h";
  histfunc?: "count" | "sum" | "avg" | "min" | "max";
  histnorm?: "" | "percent" | "probability" | "density" | "probability density";
  cumulative?: {
    enabled?: boolean;
    direction?: "increasing" | "decreasing";
    currentbin?: "include" | "exclude" | "half";
  };
  marker?: {
    color?: string;
    opacity?: number;
    line?: {
      color?: string;
      width?: number;
    };
  };
  text?: string | string[];
  textposition?: string;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
}

export interface HistogramProps extends BaseChartProps {
  data: HistogramSeriesData[];
  barmode?: "stack" | "group" | "overlay" | "relative";
  barnorm?: "" | "fraction" | "percent";
  orientation?: "v" | "h";
  /**
   * Distribution overlay to draw on top of every histogram series. `"normal"`
   * computes μ and σ from each series's data, samples the resulting PDF, and
   * adds a smooth line trace alongside the histogram trace. The histogram's
   * `histnorm` should be `"probability density"` so the curve and bars share
   * a Y scale; the renderer enforces this when the overlay is on.
   */
  fitOverlay?: "normal";
  /**
   * Optional facet grid spec. When present, traces are routed to cells
   * via their `xaxisId` / `yaxisId` and the layout emits a `grid`
   * block plus per-cell axis configs + cell-title annotations.
   */
  subplots?: FacetGridConfig;
}

/** Sample count for the fitted-PDF curve. ~120 makes the line look smooth
 *  even when the data range is narrow without bloating the trace. */
const FIT_OVERLAY_SAMPLES = 120;
/** How far past the data's min/max the overlay extends, in standard
 *  deviations. Two σ keeps the tails visible without dragging the axis
 *  range out into empty space. */
const FIT_OVERLAY_TAIL_SIGMAS = 2;

function gaussianPdf(x: number, mean: number, std: number): number {
  if (std <= 0) return 0;
  const z = (x - mean) / std;
  return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
}

/** Compute the (x, y) samples of a fitted normal PDF for a numeric series. */
function buildNormalFit(values: ReadonlyArray<string | number | Date | undefined>): {
  xs: number[];
  ys: number[];
  mean: number;
  std: number;
} | null {
  const numeric: number[] = [];
  for (const v of values) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) numeric.push(n);
  }
  if (numeric.length < 2) return null;
  const mean = numeric.reduce((acc, n) => acc + n, 0) / numeric.length;
  const variance =
    numeric.reduce((acc, n) => acc + (n - mean) * (n - mean), 0) / (numeric.length - 1);
  const std = Math.sqrt(variance);
  if (!Number.isFinite(std) || std <= 0) return null;
  const dataMin = Math.min(...numeric);
  const dataMax = Math.max(...numeric);
  const start = Math.min(dataMin, mean - FIT_OVERLAY_TAIL_SIGMAS * std);
  const end = Math.max(dataMax, mean + FIT_OVERLAY_TAIL_SIGMAS * std);
  const step = (end - start) / (FIT_OVERLAY_SAMPLES - 1);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < FIT_OVERLAY_SAMPLES; i++) {
    const x = start + i * step;
    xs.push(x);
    ys.push(gaussianPdf(x, mean, std));
  }
  return { xs, ys, mean, std };
}

export function Histogram({
  data,
  config = {},
  className,
  loading,
  error,
  barmode = "group",
  barnorm = "",
  orientation = "v",
  fitOverlay,
  subplots,
}: HistogramProps) {
  // Facet-aware sizing: when subplots is set, the tier compares per-cell
  // area so axis fonts / margins shrink per cell.
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>(
    subplots ? { grid: { rows: subplots.rows, columns: subplots.columns } } : {},
  );
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("histogram", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: (series.orientation || orientation) === "v" ? series.x : series.y,
        y: (series.orientation || orientation) === "h" ? series.x : series.y,
        // Per-trace subplot routing for facets. Plotly reads `xaxis` /
        // `yaxis` strings (`"x"`, `"x2"`, ...) at the trace level and
        // matches them to the numbered axis configs in `layout`.
        xaxis: series.xaxisId,
        yaxis: series.yaxisId,
        name: series.name,
        type: plotType,

        // Binning
        nbinsx: series.nbinsx,
        nbinsy: series.nbinsy,
        xbins: series.xbins,
        ybins: series.ybins,
        autobinx: series.autobinx !== false,
        autobiny: series.autobiny !== false,
        bingroup: series.bingroup,

        // Histogram function and normalization
        histfunc: series.histfunc || "count",
        histnorm: series.histnorm || "",

        // Cumulative
        cumulative: series.cumulative
          ? {
              enabled: series.cumulative.enabled || false,
              direction: series.cumulative.direction || "increasing",
              currentbin: series.cumulative.currentbin || "include",
            }
          : { enabled: false },

        // Styling
        marker: {
          color: series.marker?.color || series.color,
          opacity: series.marker?.opacity || series.opacity || 0.7,
          line: series.marker?.line
            ? {
                color: series.marker.line.color,
                width: series.marker.line.width || 0.5,
              }
            : undefined,
        },

        text: series.text,
        textposition: series.textposition,
        textfont: series.textfont,

        orientation: (series.orientation || orientation) === "h" ? "h" : "v",

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  // Fitted-distribution overlays: one smooth line trace per histogram
  // series. Requires histnorm "probability density" for the curve and
  // bars to share a Y scale; the renderer enforces this.
  if (fitOverlay === "normal") {
    for (let i = 0; i < data.length; i++) {
      const series = data[i];
      const seriesOrientation = series.orientation || orientation;
      const valuesForFit = seriesOrientation === "v" ? series.x : series.y;
      if (!valuesForFit || valuesForFit.length === 0) continue;
      const fit = buildNormalFit(valuesForFit);
      if (!fit) continue;
      const lineColor = series.marker?.color || series.color;
      const fitTrace = {
        x: seriesOrientation === "v" ? fit.xs : fit.ys,
        y: seriesOrientation === "v" ? fit.ys : fit.xs,
        name: `${series.name ?? `series ${i + 1}`} (normal fit)`,
        type: "scatter",
        mode: "lines",
        line: { color: lineColor, width: 2 },
        // Bind the overlay to its parent series's legend toggle so users
        // can hide both at once, but keep its own legend entry visible
        // so the fit can be read independently.
        legendgroup: series.legendgroup ?? series.name,
        showlegend: series.showlegend !== false,
        hovertemplate: `μ=${fit.mean.toFixed(3)}<br>σ=${fit.std.toFixed(3)}<extra></extra>`,
      } as unknown as PlotData;
      plotData.push(fitTrace);
    }
  }

  const layout = createBaseLayout(config, sizing);

  // Faceted layout: convert single-canvas xaxis/yaxis into a grid of
  // numbered axes + per-cell title annotations. Mirrors what
  // CartesianChart does for the cartesian wrapper.
  if (subplots) {
    const { cellTitleFontSize } = facetTierStyles(sizing);
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

  // Add histogram specific layout properties
  (layout as any).barmode = barmode;
  if (barnorm) {
    (layout as any).barnorm = barnorm;
  }

  applyReferenceLines(layout, config.referenceLines, { cells: subplots?.cells });

  const plotConfig = createPlotlyConfig(config);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        data={plotData}
        layout={layout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}

export { Histogram2D, type Histogram2DProps, type Histogram2DSeriesData } from "./histogram-2d";
