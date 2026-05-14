"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps } from "./types";
import { createBaseLayout, createPlotlyConfig, getPlotType, getRenderer } from "./utils";

export interface CorrelationMatrixProps extends BaseChartProps {
  correlationMatrix: number[][];
  labels: string[];
  name?: string;
  showValues?: boolean;
  /** Decimals for the in-cell value text. */
  textDecimals?: number;
  colorscale?: string | Array<[number, string]>;
  /** Reverse the colorscale (Plotly `reversescale`). */
  reverseScale?: boolean;
  /** Show the colorbar on the right. */
  showColorbar?: boolean;
}

export function CorrelationMatrix({
  correlationMatrix,
  labels,
  name = "Correlation Matrix",
  showValues = true,
  textDecimals = 2,
  colorscale = "RdBu",
  reverseScale = false,
  showColorbar = true,
  ...props
}: CorrelationMatrixProps) {
  const renderer = getRenderer(props.config?.useWebGL);
  const plotType = getPlotType("heatmap", renderer);

  const plotData = [
    {
      x: labels,
      y: labels,
      z: correlationMatrix,
      type: plotType,
      colorscale,
      reversescale: reverseScale,
      showscale: showColorbar,
      // Symmetric range around 0: the diverging colorscale's neutral
      // midpoint maps to "no correlation," and -1/+1 are saturated.
      zmin: -1,
      zmax: 1,
      zmid: 0,
      text: showValues
        ? correlationMatrix.map((row) =>
            row.map((val) => (Number.isFinite(val) ? val.toFixed(textDecimals) : "")),
          )
        : undefined,
      texttemplate: showValues ? "%{text}" : undefined,
      colorbar: {
        title: { text: "Correlation", side: "right" },
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
