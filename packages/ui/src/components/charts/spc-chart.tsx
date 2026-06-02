"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps } from "./types";
import { useChartSizing } from "./use-is-compact";
import { createBaseLayout, createPlotlyConfig } from "./utils";

export interface SPCChartProps extends BaseChartProps {
  /** Time / index axis values for the main process walk. */
  x: (string | number | Date)[];
  /** Numeric Y values aligned with `x`. */
  y: number[];
  /** Center line: the process mean computed from y. */
  cl: number;
  /** Upper control limit: `cl + sigmaMultiplier * std`. */
  ucl: number;
  /** Lower control limit: `cl - sigmaMultiplier * std`. */
  lcl: number;
  /** Optional ±2σ warning band; pass `undefined` to skip. */
  warningUpper?: number;
  warningLower?: number;
  /** Indices into `x`/`y` that fell outside `[lcl, ucl]`, drawn as oversized red markers. */
  outOfControlIndices: number[];
  /** Drawing mode for the main series. */
  mode?: "markers" | "lines" | "lines+markers";
  markerSize?: number;
  markerOpacity?: number;
  /** Hex colour for the main series; out-of-control markers always use a fixed red. */
  seriesColor?: string;
}

const OUT_OF_CONTROL_COLOR = "#dc2626"; // tailwind red-600
const CL_COLOR = "#6b7280"; // tailwind gray-500
const LIMIT_COLOR = OUT_OF_CONTROL_COLOR;
const WARNING_COLOR = "#f59e0b"; // tailwind amber-500

/**
 * Statistical Process Control (Individuals / X) chart. The caller computes
 * mean, std, limits, and the out-of-control index list; this wrapper just
 * shapes the Plotly traces.
 */
export function SPCChart({
  x,
  y,
  cl,
  ucl,
  lcl,
  warningUpper,
  warningLower,
  outOfControlIndices,
  config = {},
  className,
  loading,
  error,
  mode = "lines+markers",
  markerSize = 5,
  markerOpacity = 1,
  seriesColor,
}: SPCChartProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();

  // Out-of-control overlay: pluck the offending (x, y) by index. Keeping
  // the indices distinct from the main trace lets us draw a *separate*
  // marker layer with its own size/colour without clobbering the main
  // series's marker styling.
  const outOfControlX = outOfControlIndices.map((i) => x[i]);
  const outOfControlY = outOfControlIndices.map((i) => y[i]);

  // Reference lines are scatter traces (not `layout.shapes`) so they
  // show up in the legend.
  const xStart = x[0];
  const xEnd = x[x.length - 1];

  // Flat horizontal line trace at the given y. `dash` follows SPC
  // convention: solid for center, dash for limits, longdash for warning.
  const refLine = (
    yValue: number,
    name: string,
    color: string,
    dash: "solid" | "dash" | "longdash" = "solid",
  ): PlotData =>
    ({
      x: [xStart, xEnd],
      y: [yValue, yValue],
      type: "scatter",
      mode: "lines",
      name,
      line: { color, width: 1.5, dash },
      hoverinfo: "name+y",
    }) as unknown as PlotData;

  const plotData: PlotData[] = [
    {
      x,
      y,
      type: "scatter",
      mode,
      name: "Process",
      marker: {
        size: markerSize,
        opacity: markerOpacity,
        color: seriesColor ?? "#1f77b4",
      },
      line: { color: seriesColor ?? "#1f77b4", width: 1.5 },
      hoverinfo: "x+y",
    } as unknown as PlotData,
    // Centre line is solid grey per SPC convention; dotted would compete
    // visually with the dashed control limits.
    refLine(cl, "Center", CL_COLOR, "solid"),
    refLine(ucl, "UCL", LIMIT_COLOR, "dash"),
    refLine(lcl, "LCL", LIMIT_COLOR, "dash"),
    ...(typeof warningUpper === "number"
      ? [refLine(warningUpper, "+2σ", WARNING_COLOR, "longdash")]
      : []),
    ...(typeof warningLower === "number"
      ? [refLine(warningLower, "-2σ", WARNING_COLOR, "longdash")]
      : []),
    ...(outOfControlX.length > 0
      ? [
          {
            x: outOfControlX,
            y: outOfControlY,
            type: "scatter",
            mode: "markers",
            name: "Out of control",
            // `circle-open` + 0.5 opacity is the canonical SPC violation
            // marker; the underlying process point stays visible inside
            // the open ring.
            marker: {
              size: markerSize + 4,
              symbol: "circle-open",
              color: OUT_OF_CONTROL_COLOR,
              opacity: 0.5,
              line: { width: 2, color: OUT_OF_CONTROL_COLOR },
            },
            hoverinfo: "x+y",
            hovertemplate: "<b>Out of control</b><br>x=%{x}<br>y=%{y}<extra></extra>",
          } as unknown as PlotData,
        ]
      : []),
  ];

  const layout = createBaseLayout(config, sizing);
  const plotConfig = createPlotlyConfig(config, sizing);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
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
