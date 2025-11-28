"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, MarkerConfig } from "../../common";
import {
  PlotlyChart,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
  createBaseLayout,
} from "../../common";

export interface LogSeriesData extends BaseSeries {
  x: any[];
  y: number[];
  mode?:
    | "markers"
    | "lines"
    | "lines+markers"
    | "text"
    | "markers+text"
    | "lines+text"
    | "lines+markers+text";
  marker?: MarkerConfig;
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
  type?: "scatter" | "scattergl";
}

export interface LogPlotProps extends BaseChartProps {
  data: LogSeriesData[];
  xAxisType?: "linear" | "log" | "date" | "category";
  yAxisType?: "linear" | "log" | "date" | "category";
  logBase?: {
    x?: number;
    y?: number;
  };
}

export function LogPlot({
  data,
  config = {},
  className,
  loading,
  error,
  xAxisType = "linear",
  yAxisType = "log",
  logBase = { x: 10, y: 10 },
}: LogPlotProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: series.x,
        y: series.y,
        name: series.name,
        type: series.type || plotType,
        mode: series.mode || "markers",

        marker: series.marker
          ? {
              color: series.marker.color || series.color,
              size: series.marker.size || 8,
              symbol: series.marker.symbol || "circle",
              opacity: series.marker.opacity || series.opacity || 1,
              line: series.marker.line
                ? {
                    color: series.marker.line.color,
                    width: series.marker.line.width || 0,
                  }
                : undefined,
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

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  // Create layout with logarithmic axes
  const yAxisTitle = config.yAxis?.[0]?.title;
  const layout = {
    ...createBaseLayout(config),
    xaxis: {
      title: config.xAxisTitle ? { text: config.xAxisTitle } : undefined,
      type: xAxisType,
      ...(xAxisType === "log" && logBase.x ? { base: logBase.x } : {}),
    },
    yaxis: {
      title: yAxisTitle ? { text: yAxisTitle } : undefined,
      type: yAxisType,
      ...(yAxisType === "log" && logBase.y ? { base: logBase.y } : {}),
    },
  } as any;

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
