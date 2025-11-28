"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, MarkerConfig } from "../../common";
import {
  PlotlyChart,
  createBaseLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface DotSeriesData extends BaseSeries {
  x?: (string | number | Date)[];
  y: (string | number)[];
  orientation?: "v" | "h";
  marker?: MarkerConfig & {
    symbol?: string;
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
  error_x?: {
    type?: "data" | "percent" | "sqrt" | "constant";
    array?: number[];
    value?: number;
    visible?: boolean;
  };
  error_y?: {
    type?: "data" | "percent" | "sqrt" | "constant";
    array?: number[];
    value?: number;
    visible?: boolean;
  };
}

export interface DotPlotProps extends BaseChartProps {
  data: DotSeriesData[];
  orientation?: "v" | "h";
  dotSize?: number;
  spacing?: number;
}

export function DotPlot({
  data,
  config = {},
  className,
  loading,
  error,
  orientation = "v",
  dotSize = 12,
  spacing = 0.8,
}: DotPlotProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  const plotData: PlotData[] = data.map((series) => {
    const isHorizontal = (series.orientation || orientation) === "h";

    // Determine mode based on marker size (for lollipop stems)
    const mode = series.marker?.size === 0 ? "lines" : "markers";

    return {
      x: isHorizontal ? series.y : series.x || series.y.map((_, i) => i),
      y: isHorizontal ? series.x || series.y.map((_, i) => i) : series.y,
      name: series.name,
      type: plotType,
      mode: mode,

      marker:
        mode === "markers"
          ? {
              size: series.marker?.size || dotSize,
              color: series.marker?.color || series.color,
              symbol: series.marker?.symbol || "circle",
              opacity: series.marker?.opacity || series.opacity || 1,
              line: series.marker?.line
                ? {
                    color: series.marker.line.color,
                    width: series.marker.line.width || 0,
                  }
                : undefined,
            }
          : undefined,

      line:
        mode === "lines"
          ? {
              color: series.color,
              width: 3,
            }
          : undefined,

      text: series.text,
      textposition: series.textposition || "middle center",
      textfont: series.textfont,

      error_x: series.error_x,
      error_y: series.error_y,

      visible: series.visible,
      showlegend: series.showlegend,
      legendgroup: series.legendgroup,
      hovertemplate: series.hovertemplate,
      hoverinfo: series.hoverinfo,
      customdata: series.customdata,
    } as unknown as PlotData;
  });

  const defaultYAxisType = orientation === "v" ? "linear" : "category";
  const yAxisConfig = config.yAxis?.[0];

  const layout = createBaseLayout({
    ...config,
    // Adjust bargap for dot spacing
    xAxisType: config.xAxisType || (orientation === "h" ? "linear" : undefined),
    yAxis: config.yAxis || [
      {
        type: yAxisConfig?.type || defaultYAxisType,
        title: yAxisConfig?.title,
        color: yAxisConfig?.color,
      },
    ],
  });

  // Add specific layout adjustments for dot plots
  const dotLayout = {
    ...layout,
    bargap: spacing,
    bargroupgap: 0.1,
  };

  // Fix for horizontal dot plots - ensure categorical axis
  const hasHorizontalDots = data.some((series) => (series.orientation || orientation) === "h");
  if (hasHorizontalDots) {
    dotLayout.yaxis = {
      ...dotLayout.yaxis,
      type: "category",
    };
  }

  // Check if we have categorical x data (non-numeric strings)
  const hasCategoricalX = data.some(
    (series) => series.x && series.x.some((val) => typeof val === "string" && isNaN(Number(val))),
  );
  if (hasCategoricalX && !hasHorizontalDots) {
    dotLayout.xaxis = {
      ...dotLayout.xaxis,
      type: "category",
    };
  }

  const plotConfig = createPlotlyConfig(config);

  return (
    <div className={className}>
      <PlotlyChart
        data={plotData}
        layout={dotLayout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}

// Lollipop chart component
export interface LollipopChartProps extends BaseChartProps {
  categories: string[];
  values: number[];
  name?: string;
  color?: string;
  orientation?: "v" | "h";
  stemWidth?: number;
  dotSize?: number;
}

export function LollipopChart({
  categories,
  values,
  name,
  color = "#636EFA",
  orientation = "v",
  stemWidth = 2,
  dotSize = 12,
  ...props
}: LollipopChartProps) {
  const isHorizontal = orientation === "h";

  // Create stem lines
  const stemData: DotSeriesData[] = categories.map((category, i) => ({
    x: isHorizontal
      ? ([0, values[i]] as (string | number | Date)[])
      : ([category, category] as (string | number | Date)[]),
    y: isHorizontal
      ? ([category, category] as (string | number)[])
      : ([0, values[i]] as (string | number)[]),
    name: `Stem ${i}`,
    color: color,
    orientation: orientation,
    marker: { size: 0 },
    showlegend: false,
  }));

  // Create dots
  const dotData: DotSeriesData = {
    x: isHorizontal ? values : categories,
    y: isHorizontal ? categories : values,
    name: name || "Values",
    color: color,
    orientation: orientation,
    marker: { size: dotSize, symbol: "circle" },
  };

  return (
    <DotPlot
      data={[...stemData, dotData]}
      orientation={orientation}
      config={{
        ...props.config,
        xAxisTitle: isHorizontal
          ? props.config?.xAxisTitle || "Value"
          : props.config?.xAxisTitle || "Category",
        yAxis: [
          {
            title: isHorizontal
              ? props.config?.yAxis?.[0]?.title || "Category"
              : props.config?.yAxis?.[0]?.title || "Value",
            type: props.config?.yAxis?.[0]?.type || "linear",
            color: props.config?.yAxis?.[0]?.color,
          },
        ],
      }}
      {...props}
    />
  );
}
