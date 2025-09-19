"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, MarkerConfig, ErrorBarConfig } from "../../common";
import {
  PlotlyChart,
  createBaseLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface BarSeriesData extends BaseSeries {
  x: (string | number | Date)[];
  y: (string | number)[];
  orientation?: "v" | "h"; // vertical or horizontal
  width?: number | number[];
  offset?: number | number[];
  base?: number | number[] | string;
  marker?: MarkerConfig & {
    pattern?: {
      bgcolor?: string | string[];
      fgcolor?: string | string[];
      fgopacity?: number;
      shape?: string | string[];
      size?: number | number[];
      solidity?: number | number[];
    };
  };
  text?: string | string[];
  textposition?: "inside" | "outside" | "auto" | "none";
  textangle?: number;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  error_x?: ErrorBarConfig;
  error_y?: ErrorBarConfig;
  cliponaxis?: boolean;
  constraintext?: "inside" | "outside" | "both" | "none";
  insidetextanchor?: "start" | "middle" | "end";
  outsidetextfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
}

export interface BarChartProps extends BaseChartProps {
  data: BarSeriesData[];
  barmode?: "stack" | "group" | "overlay" | "relative";
  barnorm?: "" | "fraction" | "percent";
  bargap?: number;
  bargroupgap?: number;
}

export function BarChart({
  data,
  config = {},
  className,
  loading,
  error,
  barmode = "group",
  barnorm,
  bargap,
  bargroupgap,
}: BarChartProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("bar", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: series.x,
        y: series.y,
        name: series.name,
        type: plotType,
        orientation: series.orientation || "v",

        width: series.width,
        offset: series.offset,
        base: series.base,

        marker: {
          color: series.marker?.color || series.color,
          opacity: series.marker?.opacity || series.opacity || 0.8,
          line: series.marker?.line,
          colorscale: series.marker?.colorscale,
          showscale: series.marker?.showscale || false,
          colorbar: series.marker?.colorbar,
          pattern: series.marker?.pattern,
        },

        text: series.text,
        textposition: series.textposition || "auto",
        textangle: series.textangle,
        textfont: series.textfont,

        error_x: series.error_x,
        error_y: series.error_y,

        cliponaxis: series.cliponaxis,
        constraintext: series.constraintext || "inside",
        insidetextanchor: series.insidetextanchor || "middle",
        outsidetextfont: series.outsidetextfont,

        opacity: series.opacity || 1,
        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as unknown as PlotData,
  );

  const layout = {
    ...createBaseLayout(config),
    barmode,
    barnorm,
    bargap,
    bargroupgap,
  };

  // Fix for horizontal bar charts - ensure categorical axis
  const hasHorizontalBars = plotData.some((series) => series.orientation === "h");
  if (hasHorizontalBars) {
    layout.yaxis = {
      ...layout.yaxis,
      type: "category",
    };
  }

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

// Horizontal bar chart component
export interface HorizontalBarChartProps extends Omit<BarChartProps, "data"> {
  data: Omit<BarSeriesData, "orientation">[];
}

export function HorizontalBarChart({ data, ...props }: HorizontalBarChartProps) {
  return (
    <BarChart data={data.map((series) => ({ ...series, orientation: "h" as const }))} {...props} />
  );
}

// Stacked bar chart component
export interface StackedBarChartProps extends Omit<BarChartProps, "barmode"> {
  barmode?: "stack" | "relative";
}

export function StackedBarChart({ barmode = "stack", ...props }: StackedBarChartProps) {
  return <BarChart barmode={barmode} {...props} />;
}
