"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries } from "../../common";
import {
  PlotlyChart,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
  create3DLayout,
} from "../../common";

export interface RibbonSeriesData extends BaseSeries {
  x: number[] | number[][];
  y: number[] | number[][];
  z: number[] | number[][];
  mode?: "lines" | "markers" | "lines+markers" | "surface";
  ribbonType?: "line" | "surface"; // New option to choose ribbon type
  colorscale?: string | Array<[number, string]>;
  showscale?: boolean;
  line?: {
    color?: string | string[];
    width?: number;
    colorscale?: string;
    showscale?: boolean;
  };
  marker?: {
    color?: string | string[];
    size?: number | number[];
    symbol?: string;
    colorscale?: string;
    showscale?: boolean;
    line?: {
      color?: string;
      width?: number;
    };
  };
  ribbon?: {
    show?: boolean;
    color?: string;
    opacity?: number;
  };
}

export interface Ribbon3DProps extends BaseChartProps {
  data: RibbonSeriesData[];
  scene?: {
    camera?: {
      eye?: { x?: number; y?: number; z?: number };
      center?: { x?: number; y?: number; z?: number };
      up?: { x?: number; y?: number; z?: number };
    };
    xaxis?: { title?: string };
    yaxis?: { title?: string };
    zaxis?: { title?: string };
  };
}

export function Ribbon3D({
  data,
  config = {},
  className,
  loading,
  error,
  scene = {},
}: Ribbon3DProps) {
  const renderer = getRenderer(config.useWebGL);

  const plotData: PlotData[] = data.map((series) => {
    // Check if this should be a surface-based ribbon
    if (series.ribbonType === "surface" && Array.isArray(series.x[0])) {
      return {
        x: series.x as number[][],
        y: series.y as number[][],
        z: series.z as number[][],
        name: series.name,
        type: "surface",
        colorscale: series.colorscale || [
          [0, series.color || "#3b82f6"],
          [1, series.color || "#3b82f6"],
        ],
        showscale: series.showscale || false,
        opacity: series.opacity || 0.8,
        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      } as any as PlotData;
    }

    // Default to line-based scatter3d
    const plotType = getPlotType("scatter3d", renderer);
    return {
      x: series.x as number[],
      y: series.y as number[],
      z: series.z as number[],
      name: series.name,
      type: plotType,
      mode: series.mode || "lines",

      line: series.line
        ? {
            color: series.line.color || series.color,
            width: series.line.width || 4,
            colorscale: series.line.colorscale,
            showscale: series.line.showscale || false,
          }
        : {
            color: series.color,
            width: 4,
          },

      marker: series.marker
        ? {
            color: series.marker.color || series.color,
            size: series.marker.size || 6,
            symbol: series.marker.symbol || "circle",
            colorscale: series.marker.colorscale,
            showscale: series.marker.showscale || false,
            line: series.marker.line
              ? {
                  color: series.marker.line.color,
                  width: series.marker.line.width || 0,
                }
              : undefined,
          }
        : {
            color: series.color,
            size: 6,
          },

      visible: series.visible,
      showlegend: series.showlegend,
      legendgroup: series.legendgroup,
      hovertemplate: series.hovertemplate,
      hoverinfo: series.hoverinfo,
      customdata: series.customdata,
    } as any as PlotData;
  });

  const layout = create3DLayout(config);
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
