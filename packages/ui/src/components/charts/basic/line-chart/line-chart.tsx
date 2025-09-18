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
import { PlotlyChart, createBaseLayout, createPlotlyConfig, getRenderer, getPlotType } from "../../common";

export interface LineSeriesData extends BaseSeries {
  x: (string | number | Date)[];
  y: (string | number)[];
  mode?: "lines" | "markers" | "lines+markers" | "text" | "none";
  line?: LineConfig;
  marker?: MarkerConfig;
  fill?: "none" | "tozeroy" | "tozerox" | "tonexty" | "tonextx" | "toself" | "tonext";
  fillcolor?: string;
  connectgaps?: boolean;
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
}

export interface LineChartProps extends BaseChartProps {
  data: LineSeriesData[];
}

export function LineChart({
  data,
  config = {},
  className,
  loading,
  error,
  ...eventHandlers
}: LineChartProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  const plotData: PlotData[] = data.map((series, index) => {
    const mappedSeries = {
      x: series.x,
      y: series.y,
      name: series.name,
      type: plotType,
      mode: series.mode || "lines",

      line: {
        color: series.line?.color || series.color || "#1f77b4",
        width: series.line?.width || 2,
        dash: series.line?.dash || "solid",
        shape: series.line?.shape || "linear",
        smoothing: series.line?.smoothing,
      },

      marker:
        series.marker || series.mode?.includes("markers")
          ? {
              color: series.marker?.color || series.color,
              size: series.marker?.size || 6,
              symbol: series.marker?.symbol || "circle",
              opacity: series.marker?.opacity || series.opacity || 1,
              colorscale: series.marker?.colorscale,
              showscale: series.marker?.showscale || false,
              colorbar: series.marker?.colorbar,
              line: series.marker?.line,
            }
          : undefined,

      fill: series.fill || "none",
      fillcolor: series.fillcolor,
      connectgaps: series.connectgaps !== false,

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
    } as PlotData;

    return mappedSeries;
  });

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
        {...eventHandlers}
      />
    </div>
  );
}
