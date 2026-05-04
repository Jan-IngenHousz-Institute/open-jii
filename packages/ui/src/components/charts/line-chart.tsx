"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries, LineConfig, MarkerConfig, ErrorBarConfig } from "./types";
import {
  createBaseLayout,
  createPlotlyConfig,
  detectAxisType,
  getPlotType,
  getRenderer,
} from "./utils";

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

  // Infer axis type from the data. ISO timestamps → `date` (Plotly buckets +
  // labels sensibly), genuine strings → `category`, otherwise leave as the
  // default linear scale. `coerceCell` upstream already converts numeric-
  // looking strings to numbers, so anything that's still a string here is
  // either a date or a real category.
  const xAxisType = detectAxisType(data.flatMap((series) => series.x ?? []));
  if (xAxisType === "date") {
    layout.xaxis = { ...layout.xaxis, type: "date" };
  } else if (xAxisType === "category") {
    layout.xaxis = { ...layout.xaxis, type: "category", categoryorder: "category ascending" };
  }
  const yAxisType = detectAxisType(data.flatMap((series) => series.y ?? []));
  if (yAxisType === "date") {
    layout.yaxis = { ...layout.yaxis, type: "date" };
  } else if (yAxisType === "category") {
    layout.yaxis = { ...layout.yaxis, type: "category", categoryorder: "category ascending" };
  }

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
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
