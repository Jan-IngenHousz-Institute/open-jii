"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, LineConfig, MarkerConfig } from "../../common";
import {
  PlotlyChart,
  createBaseLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface AreaSeriesData extends BaseSeries {
  x: (string | number | Date)[];
  y: (string | number)[];
  fill?: "none" | "tozeroy" | "tozerox" | "tonexty" | "tonextx" | "toself" | "tonext";
  fillcolor?: string;
  line?: LineConfig;
  marker?: MarkerConfig;
  mode?: "lines" | "markers" | "lines+markers" | "none";
  connectgaps?: boolean;
  stackgroup?: string; // For stacked area charts
  groupnorm?: "" | "fraction" | "percent"; // Normalization for stacked areas
  text?: string | string[];
  textposition?: string;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
}

export interface AreaChartProps extends BaseChartProps {
  data: AreaSeriesData[];
  stackgroup?: string;
}

export function AreaChart({
  data,
  config = {},
  className,
  loading,
  error,
  stackgroup,
}: AreaChartProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  const plotData: PlotData[] = data.map(
    (series, index) =>
      ({
        x: series.x,
        y: series.y,
        name: series.name,
        type: plotType,
        mode: series.mode || "lines",

        fill: series.fill || (index === 0 ? "tozeroy" : "tonexty"),
        fillcolor: series.fillcolor || series.color,

        line: {
          color: series.line?.color || series.color,
          width: series.line?.width || 0, // Often no line for area charts
          dash: series.line?.dash || "solid",
          shape: series.line?.shape || "linear",
          smoothing: series.line?.smoothing,
        },

        marker: series.marker
          ? {
              color: series.marker.color || series.color,
              size: series.marker.size || 0, // Usually no markers for area charts
              symbol: series.marker.symbol,
              opacity: series.marker.opacity || series.opacity,
            }
          : undefined,

        connectgaps: series.connectgaps !== false,
        stackgroup: series.stackgroup || stackgroup,
        groupnorm: series.groupnorm,

        text: series.text,
        textposition: series.textposition,
        textfont: series.textfont,

        opacity: series.opacity || 0.7,
        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as unknown as PlotData,
  );

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

// Stacked area chart component
export interface StackedAreaChartProps extends AreaChartProps {
  groupnorm?: "" | "fraction" | "percent";
}

export function StackedAreaChart({ data, groupnorm, ...props }: StackedAreaChartProps) {
  return (
    <AreaChart
      data={data.map((series) => ({
        ...series,
        stackgroup: "one", // All series in same stack group
        groupnorm: groupnorm || series.groupnorm,
        fill: "tonexty",
      }))}
      {...props}
    />
  );
}
