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

export interface ErrorBarSeriesData extends BaseSeries {
  x: (string | number | Date)[];
  y: number[];
  error_y?: {
    type: "data" | "percent" | "constant" | "sqrt";
    array?: number[];
    value?: number;
    color?: string;
    thickness?: number;
    width?: number;
    visible?: boolean;
  };
  error_x?: {
    type: "data" | "percent" | "constant" | "sqrt";
    array?: number[];
    value?: number;
    color?: string;
    thickness?: number;
    width?: number;
    visible?: boolean;
  };
  mode?: "markers" | "lines" | "lines+markers";
  marker?: MarkerConfig;
  line?: {
    color?: string;
    width?: number;
    dash?: string;
    shape?: string;
  };
}

export interface ErrorBarPlotProps extends BaseChartProps {
  data: ErrorBarSeriesData[];
}

export function ErrorBarPlot({ data, config = {}, className, loading, error }: ErrorBarPlotProps) {
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

        marker: series.marker
          ? {
              color: series.marker.color || series.color,
              size: series.marker.size || 8,
              symbol: series.marker.symbol || "circle",
              opacity: series.marker.opacity || series.opacity || 1,
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
            }
          : undefined,

        error_y: series.error_y
          ? {
              type: series.error_y.type || "data",
              array: series.error_y.array,
              value: series.error_y.value,
              color: series.error_y.color || series.color,
              thickness: series.error_y.thickness || 1,
              width: series.error_y.width || 3,
              visible: series.error_y.visible !== false,
            }
          : undefined,

        error_x: series.error_x
          ? {
              type: series.error_x.type || "data",
              array: series.error_x.array,
              value: series.error_x.value,
              color: series.error_x.color || series.color,
              thickness: series.error_x.thickness || 1,
              width: series.error_x.width || 3,
              visible: series.error_x.visible !== false,
            }
          : undefined,

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

  // Check if we have categorical x data (non-numeric strings)
  const hasCategoricalX = data.some(
    (series) => series.x && series.x.some((val) => typeof val === "string" && isNaN(Number(val))),
  );
  layout.xaxis = {
    ...layout.xaxis,
    type: "category",
  };

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

// Continuous error bars (for time series)
export interface ContinuousErrorBandsProps extends BaseChartProps {
  x: (string | number | Date)[];
  y: number[];
  yUpper: number[];
  yLower: number[];
  name?: string;
  color?: string;
  fillColor?: string;
  lineColor?: string;
}

export function ContinuousErrorBands({
  x,
  y,
  yUpper,
  yLower,
  name,
  color = "#1f77b4",
  fillColor,
  lineColor,
  config = {},
  className,
  loading,
  error,
}: ContinuousErrorBandsProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  // Convert categorical x values to numeric for continuous plotting
  const xNumeric = x.map((_, index) => index);

  const plotData = [
    // Lower bound line (invisible, just for fill)
    {
      x: xNumeric,
      y: yLower,
      type: "scatter",
      mode: "lines",
      line: {
        color: "transparent",
        width: 0,
      },
      name: `${name || "Uncertainty"} Lower`,
      showlegend: false,
      hoverinfo: "skip",
    },
    // Upper bound line with fill to lower bound
    {
      x: xNumeric,
      y: yUpper,
      type: "scatter",
      mode: "lines",
      fill: "tonexty", // Fill to the previous y (lower bound)
      fillcolor: fillColor || `rgba(${hexToRgb(color)}, 0.2)`,
      line: {
        color: "transparent",
        width: 0,
      },
      name: `${name || "Uncertainty"} Band`,
      showlegend: true,
      hoverinfo: "skip",
    },
    // Main line (mean values)
    {
      x: xNumeric,
      y: y,
      type: "scatter",
      mode: "lines+markers",
      line: {
        color: lineColor || color,
        width: 3,
      },
      marker: {
        color: lineColor || color,
        size: 6,
      },
      name: name || "Mean",
      showlegend: true,
    },
  ] as unknown as PlotData[];

  const layout = createBaseLayout(config);

  // Update layout to show original categorical labels on x-axis
  const updatedLayout = {
    ...layout,
    xaxis: {
      ...layout.xaxis,
      tickmode: "array" as const,
      tickvals: xNumeric,
      ticktext: x.map(String), // Convert to strings for Plotly compatibility
    },
  };

  const plotConfig = createPlotlyConfig(config);

  return (
    <div className={className}>
      <PlotlyChart
        data={plotData}
        layout={updatedLayout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result && result[1] && result[2] && result[3]) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `${r}, ${g}, ${b}`;
  }
  return "31, 119, 180"; // Default blue
}

// Legacy alias for backward compatibility
export const ContinuousErrorBars = ContinuousErrorBands;
