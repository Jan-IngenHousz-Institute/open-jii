"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, MarkerConfig } from "../../common";
import {
  PlotlyChart,
  create3DLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface Scatter3DSeriesData extends BaseSeries {
  x: (string | number | Date)[];
  y: (string | number)[];
  z: (string | number)[];
  mode?:
    | "markers"
    | "lines"
    | "lines+markers"
    | "text"
    | "markers+text"
    | "lines+text"
    | "lines+markers+text";
  marker?: MarkerConfig & {
    symbol?: string;
    sizemode?: "diameter" | "area";
    sizeref?: number;
    sizemin?: number;
    sizemax?: number;
    line?: {
      color?: string;
      width?: number;
      colorscale?: string;
    };
    projection?: {
      x?: { show?: boolean; opacity?: number; scale?: number };
      y?: { show?: boolean; opacity?: number; scale?: number };
      z?: { show?: boolean; opacity?: number; scale?: number };
    };
  };
  line?: {
    color?: string;
    width?: number;
    dash?: string;
    shape?: string;
    smoothing?: number;
  };
  text?: string | string[];
  textposition?: string;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  error_x?: {
    type?: "data" | "percent" | "sqrt" | "constant";
    array?: number[];
    value?: number;
    visible?: boolean;
    color?: string;
    thickness?: number;
    width?: number;
  };
  error_y?: {
    type?: "data" | "percent" | "sqrt" | "constant";
    array?: number[];
    value?: number;
    visible?: boolean;
    color?: string;
    thickness?: number;
    width?: number;
  };
  error_z?: {
    type?: "data" | "percent" | "sqrt" | "constant";
    array?: number[];
    value?: number;
    visible?: boolean;
    color?: string;
    thickness?: number;
    width?: number;
  };
  connectgaps?: boolean;
}

export interface Scatter3DProps extends BaseChartProps {
  data: Scatter3DSeriesData[];
  scene?: {
    camera?: {
      eye?: { x?: number; y?: number; z?: number };
      center?: { x?: number; y?: number; z?: number };
      up?: { x?: number; y?: number; z?: number };
      projection?: { type?: "perspective" | "orthographic" };
    };
    aspectmode?: "auto" | "cube" | "data" | "manual";
    aspectratio?: { x?: number; y?: number; z?: number };
    xaxis?: {
      title?: string;
      type?: "linear" | "log" | "date" | "category";
      range?: [number, number];
      autorange?: boolean;
      showgrid?: boolean;
      gridcolor?: string;
      showbackground?: boolean;
      backgroundcolor?: string;
    };
    yaxis?: {
      title?: string;
      type?: "linear" | "log" | "date" | "category";
      range?: [number, number];
      autorange?: boolean;
      showgrid?: boolean;
      gridcolor?: string;
      showbackground?: boolean;
      backgroundcolor?: string;
    };
    zaxis?: {
      title?: string;
      type?: "linear" | "log" | "date" | "category";
      range?: [number, number];
      autorange?: boolean;
      showgrid?: boolean;
      gridcolor?: string;
      showbackground?: boolean;
      backgroundcolor?: string;
    };
  };
}

export function Scatter3D({
  data,
  config = {},
  className,
  loading,
  error,
  scene = {},
}: Scatter3DProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter3d", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: series.x,
        y: series.y,
        z: series.z,
        name: series.name,
        type: plotType,
        mode: series.mode || "markers",

        marker: series.marker
          ? {
              color: series.marker.color || series.color,
              size: series.marker.size || 8,
              symbol: series.marker.symbol || "circle",
              opacity: series.marker.opacity || series.opacity || 1,
              sizemode: series.marker.sizemode || "diameter",
              sizeref: series.marker.sizeref,
              sizemin: series.marker.sizemin,
              sizemax: series.marker.sizemax,
              line: series.marker.line
                ? {
                    color: series.marker.line.color,
                    width: series.marker.line.width || 0,
                    colorscale: series.marker.line.colorscale,
                  }
                : undefined,
              colorscale: series.marker.colorscale,
              colorbar: series.marker.colorbar,
              projection: series.marker.projection,
            }
          : {
              color: series.color,
              size: 8,
            },

        line: series.line
          ? {
              color: series.line.color || series.color,
              width: series.line.width || 2,
              dash: series.line.dash || "solid",
              shape: series.line.shape || "linear",
              smoothing: series.line.smoothing,
            }
          : undefined,

        text: series.text,
        textposition: series.textposition || "middle center",
        textfont: series.textfont,

        error_x: series.error_x,
        error_y: series.error_y,
        error_z: series.error_z,

        connectgaps: series.connectgaps !== false,

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  const layout = create3DLayout(config);

  // Add 3D scene configuration
  (layout as any).scene = {
    // Layout type allows flexible scene property assignment
    camera: scene.camera || {
      eye: { x: 1.25, y: 1.25, z: 1.25 },
      projection: { type: "perspective" },
    },
    aspectmode: scene.aspectmode || "auto",
    aspectratio: scene.aspectratio,
    xaxis: {
      title: scene.xaxis?.title || config.xAxisTitle || "X",
      type: scene.xaxis?.type,
      range: scene.xaxis?.range,
      autorange: scene.xaxis?.autorange !== false,
      showgrid: scene.xaxis?.showgrid !== false,
      gridcolor: scene.xaxis?.gridcolor || "#E6E6E6",
      showbackground: scene.xaxis?.showbackground !== false,
      backgroundcolor: scene.xaxis?.backgroundcolor || "rgba(204, 204, 204, 0.5)",
    },
    yaxis: {
      title: scene.yaxis?.title || config.yAxisTitle || "Y",
      type: scene.yaxis?.type,
      range: scene.yaxis?.range,
      autorange: scene.yaxis?.autorange !== false,
      showgrid: scene.yaxis?.showgrid !== false,
      gridcolor: scene.yaxis?.gridcolor || "#E6E6E6",
      showbackground: scene.yaxis?.showbackground !== false,
      backgroundcolor: scene.yaxis?.backgroundcolor || "rgba(204, 204, 204, 0.5)",
    },
    zaxis: {
      title: scene.zaxis?.title || config.zAxisTitle || "Z",
      type: scene.zaxis?.type,
      range: scene.zaxis?.range,
      autorange: scene.zaxis?.autorange !== false,
      showgrid: scene.zaxis?.showgrid !== false,
      gridcolor: scene.zaxis?.gridcolor || "#E6E6E6",
      showbackground: scene.zaxis?.showbackground !== false,
      backgroundcolor: scene.zaxis?.backgroundcolor || "rgba(204, 204, 204, 0.5)",
    },
  };

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

// 3D bubble chart
export interface Bubble3DProps extends BaseChartProps {
  x: number[];
  y: number[];
  z: number[];
  size: number[];
  name?: string;
  color?: string | number[];
  sizeref?: number;
  sizemode?: "diameter" | "area";
}

export function Bubble3D({
  x,
  y,
  z,
  size,
  name,
  color,
  sizeref,
  sizemode = "diameter",
  ...props
}: Bubble3DProps) {
  return (
    <Scatter3D
      data={[
        {
          x: x,
          y: y,
          z: z,
          name: name,
          color: Array.isArray(color) ? undefined : color,
          marker: {
            size: size,
            color: Array.isArray(color) ? color : undefined,
            sizeref: sizeref || (2 * Math.max(...size)) / 40 ** 2,
            sizemode: sizemode,
            colorscale: Array.isArray(color) ? "Viridis" : undefined,
            showscale: Array.isArray(color),
            colorbar: Array.isArray(color)
              ? {
                  title: "Color Value",
                }
              : undefined,
          },
        },
      ]}
      {...props}
    />
  );
}

// 3D trajectory plot (path through 3D space)
export interface Trajectory3DProps extends BaseChartProps {
  x: number[];
  y: number[];
  z: number[];
  name?: string;
  color?: string;
  showMarkers?: boolean;
  markerSize?: number;
  lineWidth?: number;
  showStartEnd?: boolean;
}
