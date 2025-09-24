"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries } from "../../common";
import {
  PlotlyChart,
  createBaseLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface HeatmapSeriesData extends BaseSeries {
  x?: (string | number | Date)[];
  y?: (string | number | Date)[];
  z: (string | number)[][];
  colorscale?: string | Array<[number, string]>;
  showscale?: boolean;
  zmid?: number;
  zmin?: number;
  zmax?: number;
  zauto?: boolean;
  colorbar?: {
    title?: string;
    titleside?: "right" | "top" | "bottom";
    thickness?: number;
    len?: number;
    x?: number;
    y?: number;
    tickmode?: "linear" | "array";
    tick0?: number;
    dtick?: number;
    tickvals?: number[];
    ticktext?: string[];
    tickformat?: string;
  };
  text?: string[][];
  texttemplate?: string;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  hoverongaps?: boolean;
  connectgaps?: boolean;
  xgap?: number;
  ygap?: number;
  transpose?: boolean;
}

export interface HeatmapProps extends BaseChartProps {
  data: HeatmapSeriesData[];
  aspectRatio?: "auto" | "equal";
}

export function Heatmap({
  data,
  config = {},
  className,
  loading,
  error,
  aspectRatio = "auto",
}: HeatmapProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("heatmap", renderer);

  const plotData: PlotData[] = data.map((series) => {
    return {
      x: series.x,
      y: series.y,
      z: series.z,
      name: series.name,
      type: plotType,

      // Color scale configuration - only set if provided
      colorscale: series.colorscale,
      showscale: series.showscale,
      zmid: series.zmid,
      zmin: series.zmin,
      zmax: series.zmax,
      zauto: series.zauto !== false,

      // Color bar
      colorbar: series.colorbar || {
        title: "Value",
        titleside: "right",
      },

      // Text annotations
      text: series.text,
      texttemplate: series.texttemplate,
      textfont: series.textfont || {
        size: 12,
        color: "white",
      },

      // Gaps and layout
      hoverongaps: series.hoverongaps !== false,
      connectgaps: series.connectgaps !== false,
      xgap: series.xgap || 1,
      ygap: series.ygap || 1,
      transpose: series.transpose || false,

      visible: series.visible,
      showlegend: series.showlegend,
      legendgroup: series.legendgroup,
      hovertemplate: series.hovertemplate,
      hoverinfo: series.hoverinfo,
      customdata: series.customdata,
    } as any as PlotData;
  });

  const layout = createBaseLayout(config);

  // Determine axis types based on data
  const firstSeries = data[0];

  // Check X-axis data type
  const xAxisType =
    firstSeries?.x && firstSeries.x.length > 0
      ? typeof firstSeries.x[0] === "string" || firstSeries.x[0] instanceof Date
        ? "category"
        : "linear"
      : "linear";

  // Check Y-axis data type
  const yAxisType =
    firstSeries?.y && firstSeries.y.length > 0
      ? typeof firstSeries.y[0] === "string" || firstSeries.y[0] instanceof Date
        ? "category"
        : "linear"
      : "linear";

  layout.xaxis = {
    ...layout.xaxis,
    type: xAxisType,
  };

  layout.yaxis = {
    ...layout.yaxis,
    type: yAxisType,
  };

  // Set aspect ratio if specified
  if (aspectRatio === "equal") {
    (layout as any).yaxis = {
      ...(layout as any).yaxis,
      scaleanchor: "x",
      scaleratio: 1,
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

// Correlation matrix heatmap
export interface CorrelationMatrixProps extends BaseChartProps {
  correlationMatrix: number[][];
  labels: string[];
  name?: string;
  showValues?: boolean;
  colorscale?: string;
}

export function CorrelationMatrix({
  correlationMatrix,
  labels,
  name = "Correlation Matrix",
  showValues = true,
  colorscale = "RdBu",
  ...props
}: CorrelationMatrixProps) {
  const renderer = getRenderer(props.config?.useWebGL);
  const plotType = getPlotType("heatmap", renderer);

  const plotData = [
    {
      x: labels,
      y: labels,
      z: correlationMatrix,
      type: "heatmap",
      colorscale: colorscale,
      showscale: true,
      zmin: -1,
      zmax: 1,
      zmid: 0,
      text: showValues
        ? correlationMatrix.map((row) => row.map((val) => val.toFixed(2)))
        : undefined,
      texttemplate: showValues ? "%{text}" : undefined,
      textfont: {
        size: 12,
        color: "black",
      },
      colorbar: {
        title: "Correlation",
        titleside: "right",
        thickness: 15,
        len: 0.8,
        tickmode: "linear",
        tick0: -1,
        dtick: 0.5,
      },
      hovertemplate: "<b>%{y} vs %{x}</b><br>" + "Correlation: %{z:.3f}<br>" + "<extra></extra>",
    },
  ] as unknown as PlotData[];

  const layout = createBaseLayout(props.config || {});

  const enhancedLayout = {
    ...layout,
    title: {
      ...layout.title,
      text: props.config?.title || name,
    },
    xaxis: {
      ...layout.xaxis,
      side: "bottom" as const,
      tickangle: 45,
      showgrid: false,
      zeroline: false,
      showline: false,
      ticks: "" as const,
      showticklabels: true,
      type: "category" as const,
    },
    yaxis: {
      ...layout.yaxis,
      showgrid: false,
      zeroline: false,
      showline: false,
      ticks: "" as const,
      showticklabels: true,
      autorange: "reversed" as const,
      type: "category" as const,
    },
    plot_bgcolor: "white",
    paper_bgcolor: "white",
  };

  const plotConfig = createPlotlyConfig(props.config || {});

  return (
    <div className={props.className}>
      <PlotlyChart
        data={plotData}
        layout={enhancedLayout}
        config={plotConfig}
        loading={props.loading}
        error={props.error}
      />
    </div>
  );
}
