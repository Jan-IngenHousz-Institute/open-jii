"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type {
  BaseChartProps,
  BaseSeries,
  LineConfig,
  MarkerConfig,
  ErrorBarConfig,
} from "../../common";
import {
  PlotlyChart,
  createBaseLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface ScatterSeriesData extends BaseSeries {
  x: (string | number | Date)[];
  y: (string | number)[];
  mode?:
    | "markers"
    | "lines"
    | "lines+markers"
    | "markers+text"
    | "lines+markers+text"
    | "text"
    | "none";
  marker?: MarkerConfig;
  line?: LineConfig;
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
    | "bottom right";
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  error_x?: ErrorBarConfig;
  error_y?: ErrorBarConfig;
  fill?: "none" | "tozeroy" | "tozerox" | "tonexty" | "tonextx" | "toself" | "tonext";
  fillcolor?: string;
  // Bubble chart support
  size?: number[];
  sizemode?: "diameter" | "area";
  sizeref?: number;
  sizemin?: number;
}

export interface ScatterChartProps extends BaseChartProps {
  data: ScatterSeriesData[];
}

export function ScatterChart({ data, config = {}, className, loading, error }: ScatterChartProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: series.x,
        y: series.y,
        name: series.name,
        type: plotType,
        mode: series.mode || "markers",

        marker: {
          color: series.marker?.color || series.color,
          size: series.size || series.marker?.size || 8,
          symbol: series.marker?.symbol || "circle",
          opacity: series.marker?.opacity || series.opacity || 0.8,
          colorscale: series.marker?.colorscale,
          showscale: series.marker?.showscale || false,
          colorbar: series.marker?.colorbar,
          line: series.marker?.line,
          sizemode: series.sizemode,
          sizeref: series.sizeref,
          sizemin: series.sizemin,
        },

        line:
          series.line && series.mode?.includes("lines")
            ? {
                color: series.line.color || series.color,
                width: series.line.width || 2,
                dash: series.line.dash || "solid",
                shape: series.line.shape || "linear",
                smoothing: series.line.smoothing,
              }
            : undefined,

        fill: series.fill || "none",
        fillcolor: series.fillcolor,

        text: series.text,
        textposition: series.textposition,
        textfont: series.textfont,

        error_x: series.error_x,
        error_y: series.error_y,

        opacity: series.opacity || 1,
        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as PlotData,
  );

  const layout = createBaseLayout(config);
  const plotConfig = createPlotlyConfig(config);

  // Check if we have categorical x data (non-numeric strings)
  const hasCategoricalX = data.some(
    (series) => series.x && series.x.some((val) => typeof val === "string" && isNaN(Number(val))),
  );
  if (hasCategoricalX) {
    layout.xaxis = {
      ...layout.xaxis,
      type: "category",
      categoryorder: "category ascending",
    };
  }

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

// Bubble chart component (scatter with size encoding)
export interface BubbleChartProps extends BaseChartProps {
  data: Array<
    {
      x: (string | number | Date)[];
      y: (string | number)[];
      size: number[];
      color?: string | string[];
      name?: string;
      text?: string | string[];
      sizemode?: "diameter" | "area";
      sizeref?: number;
      sizemin?: number;
    } & BaseSeries
  >;
}

export function BubbleChart({ data, ...props }: BubbleChartProps) {
  return (
    <ScatterChart
      data={data.map((series) => ({
        ...series,
        mode: "markers" as const,
        sizemode: series.sizemode || "area",
        sizeref: series.sizeref,
        sizemin: series.sizemin,
      }))}
      {...props}
    />
  );
}
