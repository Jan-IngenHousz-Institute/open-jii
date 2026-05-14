"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps } from "./types";
import { useChartSizing } from "./use-is-compact";
import { createBaseLayout, createPlotlyConfig } from "./utils";

/**
 * One ridge, pre-computed by the caller. The wrapper just shapes Plotly
 * traces: closed-path with `fill: 'toself'` and a category-tick Y axis.
 */
export interface RidgeSeriesData {
  /** Display name shown on the Y-axis tick + in the legend (when shown). */
  name: string;
  /** Sample points along the value axis (X). Shared across ridges so peaks line up. */
  xs: number[];
  /** Per-sample-point Y values, already lane-offset (lane base + curve height). */
  ys: number[];
  /** The lane's vertical baseline; the curve fills down to this Y value. */
  laneBaseY: number;
  /** Outline + fill colour. The fill is rgba'd from this hex with `fillOpacity`. */
  color: string;
}

export interface RidgePlotProps extends BaseChartProps {
  data: RidgeSeriesData[];
  /** Y-axis tick positions (lane base offsets) and labels (category names). */
  categoryTicks: { value: number; label: string }[];
  /** Outline thickness in pixels. */
  lineWidth?: number;
  /** Whether to fill each ridge's interior. */
  fill?: boolean;
  /** Alpha for the fill colour (0–1). The outline stays fully opaque. */
  fillOpacity?: number;
}

/**
 * Ridge plot (joypy / ggridges style). Each ridge is one `scatter` trace
 * with `fill: 'toself'` and a closed path. Y axis uses `tickmode: 'array'`
 * so ticks land exactly on the lane base positions.
 */
export function RidgePlot({
  data,
  categoryTicks,
  config = {},
  className,
  loading,
  error,
  lineWidth = 1.5,
  fill = true,
  fillOpacity = 0.7,
}: RidgePlotProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        // Closed path: curve points → bottom-right corner → bottom-left
        // corner → (auto-closed back to start). Plotly's `fill: 'toself'`
        // fills inside the polygon; without the corners the fill bleeds
        // sideways from the curve's endpoints down to whatever the next
        // trace starts at.
        x: [...series.xs, series.xs[series.xs.length - 1], series.xs[0]],
        y: [...series.ys, series.laneBaseY, series.laneBaseY],
        name: series.name,
        type: "scatter",
        mode: "lines",
        line: { color: series.color, width: lineWidth },
        fill: fill ? "toself" : "none",
        fillcolor: fill ? withAlpha(series.color, fillOpacity) : undefined,
        showlegend: false,
        hoverinfo: "name+x",
      }) as unknown as PlotData,
  );

  const layout = createBaseLayout(config, sizing);

  // Custom Y axis: category labels at the lane bases. Hide grid and
  // zeroline because they'd cut across every ridge as horizontal noise.
  layout.yaxis = {
    ...layout.yaxis,
    tickmode: "array",
    tickvals: categoryTicks.map((t) => t.value),
    ticktext: categoryTicks.map((t) => t.label),
    showgrid: false,
    zeroline: false,
  };

  const plotConfig = createPlotlyConfig(config, sizing);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart data={plotData} layout={layout} config={plotConfig} loading={loading} error={error} />
    </div>
  );
}

/** Local hex-to-rgba helper to keep this wrapper self-contained. */
function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) {
    return `rgba(31, 119, 180, ${alpha})`;
  }
  const expanded =
    hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(expanded.slice(1, 3), 16);
  const g = parseInt(expanded.slice(3, 5), 16);
  const b = parseInt(expanded.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
