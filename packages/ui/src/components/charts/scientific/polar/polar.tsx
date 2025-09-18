"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, MarkerConfig } from "../../common";
import { PlotlyChart, createPlotlyConfig, getRenderer, getPlotType } from "../../common";

export interface PolarSeriesData extends BaseSeries {
  r: number[];
  theta: number[] | string[];
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
    line?: {
      color?: string;
      width?: number;
    };
  };
  line?: {
    color?: string;
    width?: number;
    dash?: string;
    shape?: string;
    smoothing?: number;
  };
  fill?: "none" | "toself" | "tonext";
  fillcolor?: string;
  text?: string | string[];
  textposition?: string;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  type?: "scatterpolar" | "scatterpolargl" | "barpolar";
}

export interface PolarPlotProps extends BaseChartProps {
  data: PolarSeriesData[];
  radialAxis?: {
    title?: string;
    range?: [number, number];
    tickmode?: "linear" | "array";
    tick0?: number;
    dtick?: number;
    tickvals?: number[];
    ticktext?: string[];
    angle?: number;
    side?: "clockwise" | "counterclockwise";
    gridcolor?: string;
    linecolor?: string;
    showgrid?: boolean;
    showline?: boolean;
    showticklabels?: boolean;
  };
  angularAxis?: {
    title?: string;
    tickmode?: "linear" | "array";
    tick0?: number;
    dtick?: number;
    tickvals?: number[];
    ticktext?: string[];
    direction?: "clockwise" | "counterclockwise";
    rotation?: number;
    period?: number;
    gridcolor?: string;
    linecolor?: string;
    showgrid?: boolean;
    showline?: boolean;
    showticklabels?: boolean;
  };
  sector?: {
    start?: number;
    end?: number;
  };
  hole?: number;
  bgcolor?: string;
}

export function PolarPlot({
  data,
  config = {},
  className,
  loading,
  error,
  radialAxis = {},
  angularAxis = {},
  sector,
  hole = 0,
  bgcolor = "white",
}: PolarPlotProps) {
  const renderer = getRenderer(config.useWebGL);

  const plotData: PlotData[] = data.map((series) => {
    const baseType = series.type || "scatterpolar";
    const plotType = getPlotType(baseType, renderer);

    return {
      r: series.r,
      theta: series.theta,
      name: series.name,
      type: plotType,
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

      fill: series.fill || "none",
      fillcolor: series.fillcolor || series.color,

      text: series.text,
      textposition: series.textposition || "middle center",
      textfont: series.textfont,

      visible: series.visible,
      showlegend: series.showlegend,
      legendgroup: series.legendgroup,
      hovertemplate: series.hovertemplate,
      hoverinfo: series.hoverinfo,
      customdata: series.customdata,
    } as any as PlotData;
  });

  // Create polar layout with responsive sizing
  const layout = {
    title: config.title ? { text: config.title } : undefined,
    // Remove fixed width/height to allow container-based sizing
    paper_bgcolor: config.backgroundColor || "white",
    plot_bgcolor: bgcolor,
    autosize: true, // Enable responsive sizing

    polar: {
      radialaxis: {
        title: radialAxis.title || "R",
        range: radialAxis.range,
        tickmode: radialAxis.tickmode || "linear",
        tick0: radialAxis.tick0 || 0,
        dtick: radialAxis.dtick,
        tickvals: radialAxis.tickvals,
        ticktext: radialAxis.ticktext,
        angle: radialAxis.angle || 90,
        side: radialAxis.side || "clockwise",
        gridcolor: radialAxis.gridcolor || "#E6E6E6",
        linecolor: radialAxis.linecolor || "#444",
        showgrid: radialAxis.showgrid !== false,
        showline: radialAxis.showline !== false,
        showticklabels: radialAxis.showticklabels !== false,
      },
      angularaxis: {
        title: angularAxis.title || "θ",
        tickmode: angularAxis.tickmode || "linear",
        tick0: angularAxis.tick0 || 0,
        dtick: angularAxis.dtick || 45,
        tickvals: angularAxis.tickvals,
        ticktext: angularAxis.ticktext,
        direction: angularAxis.direction || "counterclockwise",
        rotation: angularAxis.rotation || 0,
        period: angularAxis.period || 360,
        gridcolor: angularAxis.gridcolor || "#E6E6E6",
        linecolor: angularAxis.linecolor || "#444",
        showgrid: angularAxis.showgrid !== false,
        showline: angularAxis.showline !== false,
        showticklabels: angularAxis.showticklabels !== false,
      },
      ...(sector
        ? {
            sector: [sector.start || 0, sector.end || 360],
          }
        : {}),
      hole: hole,
      bgcolor: bgcolor,
    },

    showlegend: config.showLegend !== false,
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
