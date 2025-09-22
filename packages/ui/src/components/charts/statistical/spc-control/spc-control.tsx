"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries } from "../../common";
import {
  PlotlyChart,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
  createBaseLayout,
} from "../../common";

export interface SPCSeriesData extends BaseSeries {
  x: any[]; // Mixed types for time series, categories, or numeric data
  y: number[];
  mode?: "markers" | "lines" | "lines+markers";
  marker?: {
    color?: string;
    size?: number;
    symbol?: string;
  };
  line?: {
    color?: string;
    width?: number;
    dash?: string;
  };
}

export interface SPCControlChartsProps extends BaseChartProps {
  data: SPCSeriesData[];
  centerLine?: number;
  upperControlLimit?: number;
  lowerControlLimit?: number;
  upperSpecLimit?: number;
  lowerSpecLimit?: number;
  controlLimitColor?: string;
  specLimitColor?: string;
  centerLineColor?: string;
  showControlLimits?: boolean;
  showSpecLimits?: boolean;
  showCenterLine?: boolean;
}

export function SPCControlCharts({
  data,
  config = {},
  className,
  loading,
  error,
  centerLine,
  upperControlLimit,
  lowerControlLimit,
  upperSpecLimit,
  lowerSpecLimit,
  controlLimitColor = "#ff6b6b",
  specLimitColor = "#ffa726",
  centerLineColor = "#4dabf7",
  showControlLimits = true,
  showSpecLimits = true,
  showCenterLine = true,
}: SPCControlChartsProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  // Calculate control limits if not provided
  const allYValues = data.flatMap((series) => series.y);
  const mean = allYValues.reduce((sum, val) => sum + val, 0) / allYValues.length;
  const stdDev = Math.sqrt(
    allYValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allYValues.length,
  );

  const calculatedCenterLine = centerLine ?? mean;
  const calculatedUCL = upperControlLimit ?? mean + 3 * stdDev;
  const calculatedLCL = lowerControlLimit ?? mean - 3 * stdDev;

  // Get x-axis range for control lines
  const allXValues = data.flatMap((series) => series.x);
  const numericXValues = allXValues.filter((v) => typeof v === "number" && isFinite(v));
  const xMin = Math.min(...numericXValues);
  const xMax = Math.max(...numericXValues);

  const plotData: PlotData[] = [
    // Main data series
    ...data.map(
      (series) =>
        ({
          x: series.x,
          y: series.y,
          name: series.name,
          type: plotType,
          mode: series.mode || "lines+markers",

          marker: series.marker
            ? {
                color: series.marker.color || series.color,
                size: series.marker.size || 6,
                symbol: series.marker.symbol || "circle",
              }
            : {
                color: series.color,
                size: 6,
              },

          line: series.line
            ? {
                color: series.line.color || series.color,
                width: series.line.width || 2,
                dash: series.line.dash || "solid",
              }
            : {
                color: series.color,
                width: 2,
              },

          visible: series.visible,
          showlegend: series.showlegend,
          legendgroup: series.legendgroup,
          hovertemplate: series.hovertemplate,
          hoverinfo: series.hoverinfo,
          customdata: series.customdata,
        }) as any as PlotData,
    ),

    // Center line
    ...(showCenterLine
      ? [
          {
            x: [xMin, xMax],
            y: [calculatedCenterLine, calculatedCenterLine],
            type: plotType,
            mode: "lines",
            name: "Center Line",
            line: {
              color: centerLineColor,
              width: 2,
              dash: "solid",
            },
            showlegend: false,
            hoverinfo: "skip",
          } as any as PlotData,
        ]
      : []),

    // Upper Control Limit
    ...(showControlLimits
      ? [
          {
            x: [xMin, xMax],
            y: [calculatedUCL, calculatedUCL],
            type: plotType,
            mode: "lines",
            name: "UCL",
            line: {
              color: controlLimitColor,
              width: 2,
              dash: "dash",
            },
            showlegend: false,
            hoverinfo: "skip",
          } as any as PlotData,
        ]
      : []),

    // Lower Control Limit
    ...(showControlLimits
      ? [
          {
            x: [xMin, xMax],
            y: [calculatedLCL, calculatedLCL],
            type: plotType,
            mode: "lines",
            name: "LCL",
            line: {
              color: controlLimitColor,
              width: 2,
              dash: "dash",
            },
            showlegend: false,
            hoverinfo: "skip",
          } as any as PlotData,
        ]
      : []),

    // Upper Specification Limit
    ...(showSpecLimits && upperSpecLimit !== undefined
      ? [
          {
            x: [xMin, xMax],
            y: [upperSpecLimit, upperSpecLimit],
            type: plotType,
            mode: "lines",
            name: "USL",
            line: {
              color: specLimitColor,
              width: 2,
              dash: "dot",
            },
            showlegend: false,
            hoverinfo: "skip",
          } as any as PlotData,
        ]
      : []),

    // Lower Specification Limit
    ...(showSpecLimits && lowerSpecLimit !== undefined
      ? [
          {
            x: [xMin, xMax],
            y: [lowerSpecLimit, lowerSpecLimit],
            type: plotType,
            mode: "lines",
            name: "LSL",
            line: {
              color: specLimitColor,
              width: 2,
              dash: "dot",
            },
            showlegend: false,
            hoverinfo: "skip",
          } as any as PlotData,
        ]
      : []),
  ];

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
