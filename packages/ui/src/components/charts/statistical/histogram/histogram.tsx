"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries } from "../../common";
import {
  PlotlyChart,
  createBaseLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface HistogramSeriesData extends BaseSeries {
  x?: (string | number | Date)[];
  y?: (string | number)[];
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
}: HistogramProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("histogram", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: (series.orientation || orientation) === "v" ? series.x : series.y,
        y: (series.orientation || orientation) === "h" ? series.x : series.y,
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

  const layout = createBaseLayout(config);

  // Add histogram specific layout properties
  (layout as any).barmode = barmode;
  if (barnorm) {
    (layout as any).barnorm = barnorm;
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

// 2D Histogram (heatmap-style)
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
  showscale?: boolean;
  colorbar?: {
    title?: string;
    titleside?: "right" | "top" | "bottom";
    thickness?: number;
    len?: number;
    x?: number;
    y?: number;
  };
}

export interface Histogram2DProps extends BaseChartProps {
  data: Histogram2DSeriesData[];
}

export function Histogram2D({ data, config = {}, className, loading, error }: Histogram2DProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("histogram2d", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: series.x,
        y: series.y,
        z: series.z,
        name: series.name,
        type: plotType,

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
        showscale: series.showscale !== false,
        colorbar: series.colorbar || {
          title: "Count",
          titleside: "right",
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
