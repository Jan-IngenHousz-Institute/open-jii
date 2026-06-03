"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries } from "./types";
import { createBaseLayout, createPlotlyConfig, getRenderer, getPlotType } from "./utils";

export interface HeatmapSeriesData extends BaseSeries {
  x?: (string | number | Date)[];
  y?: (string | number | Date)[];
  z: (string | number)[][];
  colorscale?: string | Array<[number, string]>;
  /** Reverse the colorscale (Plotly `reversescale`). */
  reversescale?: boolean;
  showscale?: boolean;
  zmid?: number;
  zmin?: number;
  zmax?: number;
  zauto?: boolean;
  /**
   * Cell-edge interpolation. `false` keeps the discrete-cell heatmap
   * look; `"best"`/`"fast"` smooth the transitions for a gradient
   * appearance. Plotly defaults to `false` on `heatmap`, which is the
   * canonical academic look; surfacing this so a dense matrix can opt
   * into smoothing without leaving the heatmap chart family.
   */
  zsmooth?: false | "best" | "fast";
  colorbar?: {
    /**
     * Plotly 3.x uses the nested `title: { text, side }` form. The older
     * top-level `title: string, titleside: "right"` shape is silently
     * dropped on render.
     */
    title?: { text?: string; side?: "right" | "top" | "bottom" };
    thickness?: number;
    len?: number;
    x?: number;
    y?: number;
    tickmode?: "linear" | "array";
    tick0?: number;
    dtick?: number;
    tickvals?: number[];
    ticktext?: string[];
    tickformat?: string;
  };
  text?: string[][];
  texttemplate?: string;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  hoverongaps?: boolean;
  connectgaps?: boolean;
  xgap?: number;
  ygap?: number;
  transpose?: boolean;
}

export interface HeatmapProps extends BaseChartProps {
  data: HeatmapSeriesData[];
  aspectRatio?: "auto" | "equal";
}

export function Heatmap({
  data,
  config = {},
  className,
  loading,
  error,
  aspectRatio = "auto",
}: HeatmapProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("heatmap", renderer);

  const plotData: PlotData[] = data.map((series) => {
    return {
      x: series.x,
      y: series.y,
      z: series.z,
      name: series.name,
      type: plotType,

      // Color scale configuration - only set if provided
      colorscale: series.colorscale,
      reversescale: series.reversescale === true,
      showscale: series.showscale,
      zmid: series.zmid,
      zmin: series.zmin,
      zmax: series.zmax,
      zauto: series.zauto !== false,
      zsmooth: series.zsmooth ?? false,

      // Color bar uses Plotly 3.x nested form.
      colorbar: series.colorbar || {
        title: { text: "Value", side: "right" },
      },

      // Text annotations
      text: series.text,
      texttemplate: series.texttemplate,
      textfont: series.textfont,

      // Gaps and layout
      hoverongaps: series.hoverongaps !== false,
      connectgaps: series.connectgaps !== false,
      xgap: series.xgap || 1,
      ygap: series.ygap || 1,
      transpose: series.transpose || false,

      visible: series.visible,
      showlegend: series.showlegend,
      legendgroup: series.legendgroup,
      hovertemplate: series.hovertemplate,
      hoverinfo: series.hoverinfo,
      customdata: series.customdata,
    } as any as PlotData;
  });

  const layout = createBaseLayout(config);

  // Determine axis types based on data
  const firstSeries = data[0];

  // Check X-axis data type
  const xAxisType =
    firstSeries?.x && firstSeries.x.length > 0
      ? typeof firstSeries.x[0] === "string" || firstSeries.x[0] instanceof Date
        ? "category"
        : "linear"
      : "linear";

  // Check Y-axis data type
  const yAxisType =
    firstSeries?.y && firstSeries.y.length > 0
      ? typeof firstSeries.y[0] === "string" || firstSeries.y[0] instanceof Date
        ? "category"
        : "linear"
      : "linear";

  layout.xaxis = {
    ...layout.xaxis,
    type: xAxisType,
  };

  layout.yaxis = {
    ...layout.yaxis,
    type: yAxisType,
  };

  // Set aspect ratio if specified
  if (aspectRatio === "equal") {
    (layout as any).yaxis = {
      ...(layout as any).yaxis,
      scaleanchor: "x",
      scaleratio: 1,
    };
  }

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

export { CorrelationMatrix, type CorrelationMatrixProps } from "./correlation-matrix";
