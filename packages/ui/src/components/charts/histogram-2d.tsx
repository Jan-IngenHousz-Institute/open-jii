"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries } from "./types";
import { createBaseLayout, createPlotlyConfig, getRenderer, getPlotType } from "./utils";

export interface Histogram2DSeriesData extends BaseSeries {
  x: (string | number | Date)[];
  y: (string | number)[];
  z?: (string | number)[];
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
  histfunc?: "count" | "sum" | "avg" | "min" | "max";
  histnorm?: "" | "percent" | "probability" | "density" | "probability density";
  colorscale?: string | Array<[number, string]>;
  /** Reverse the colorscale (Plotly `reversescale`). */
  reversescale?: boolean;
  showscale?: boolean;
  colorbar?: {
    /**
     * Plotly 3.x uses the nested `title: { text, side }` form. The older
     * top-level `title: string, titleside: "right"` shape is silently
     * dropped on render, so callers should always pass this nested form.
     */
    title?: { text?: string; side?: "right" | "top" | "bottom" };
    thickness?: number;
    len?: number;
    x?: number;
    y?: number;
  };
}

export interface Histogram2DProps extends BaseChartProps {
  data: Histogram2DSeriesData[];
  /**
   * `heatmap` (default) renders Plotly's `histogram2d` trace (bins as a
   * coloured grid). `contour` switches to `histogram2dcontour`: same
   * binning, drawn as iso-count contour lines / filled bands.
   */
  renderMode?: "heatmap" | "contour";
  /** When in contour mode, fill the bands between iso-levels instead of just stroking them. */
  contourFill?: boolean;
}

export function Histogram2D({
  data,
  config = {},
  className,
  loading,
  error,
  renderMode = "heatmap",
  contourFill = false,
}: Histogram2DProps) {
  const renderer = getRenderer(config.useWebGL);
  // `histogram2dcontour` has no WebGL variant; `getPlotType` falls back
  // to the SVG path automatically.
  const plotType = getPlotType(
    renderMode === "contour" ? "histogram2dcontour" : "histogram2d",
    renderer,
  );

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: series.x,
        y: series.y,
        z: series.z,
        name: series.name,
        type: plotType,
        // Contour-only: Plotly's `contours.coloring` controls whether
        // the contour layer is filled bands or just iso-lines.
        ...(renderMode === "contour"
          ? { contours: { coloring: contourFill ? "fill" : "lines" } }
          : {}),

        // Binning
        nbinsx: series.nbinsx,
        nbinsy: series.nbinsy,
        xbins: series.xbins,
        ybins: series.ybins,
        autobinx: series.autobinx !== false,
        autobiny: series.autobiny !== false,

        // Histogram function and normalization
        histfunc: series.histfunc || "count",
        histnorm: series.histnorm || "",

        // Color scale
        colorscale: series.colorscale || "Viridis",
        reversescale: series.reversescale === true,
        showscale: series.showscale !== false,
        colorbar: series.colorbar || {
          title: { text: "Count", side: "right" },
        },

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  const layout = createBaseLayout(config);
  const plotConfig = createPlotlyConfig(config);

  return (
    <div className={className}>
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
