"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps } from "./types";
import { useChartSizing } from "./use-is-compact";
import { createBaseLayout, createPlotlyConfig } from "./utils";

export interface DensityPlot2DProps extends BaseChartProps {
  /** Raw (x, y) pairs that show as the underlying scatter trace. */
  x: (string | number | Date)[];
  y: (string | number)[];
  /** Marker styling for the scatter layer. */
  markerSize?: number;
  markerOpacity?: number;
  markerColor?: string;
  /** Bin counts for the contour layer. Plotly auto-picks when undefined. */
  nbinsx?: number;
  nbinsy?: number;
  /**
   * Plotly colorscale: a built-in name (e.g. `"Viridis"`) or an explicit
   * `[[position, color], ...]` stop array. Renderers pass array form for
   * scales not in plotly.js's built-in registry.
   */
  colorscale?: string | Array<[number, string]>;
  /** Reverse the colorscale (Plotly `reversescale`). */
  reverseScale?: boolean;
  /** Fill the contour bands instead of drawing only iso-lines. */
  contourFill?: boolean;
  /** Show the colorbar legend. */
  showColorbar?: boolean;
  /** Title text shown next to the colorbar. */
  colorbarTitle?: string;
}

/**
 * Composite 2D density plot: scatter for raw points + `histogram2dcontour`
 * for density iso-lines. The caller is responsible for filtering rows
 * where either axis fails to coerce to a number.
 */
export function DensityPlot2D({
  x,
  y,
  config = {},
  className,
  loading,
  error,
  markerSize = 4,
  markerOpacity = 0.4,
  markerColor,
  nbinsx,
  nbinsy,
  colorscale = "Viridis",
  reverseScale = false,
  contourFill = false,
  showColorbar = true,
  colorbarTitle,
}: DensityPlot2DProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();

  // Scatter under, contour over (Plotly trace order). The contour only
  // renders when there's data: `makeCrossings` crashes on empty x/y.
  const hasData = x.length > 0;
  const plotData: PlotData[] = [
    {
      x,
      y,
      type: "scatter",
      mode: "markers",
      marker: {
        size: markerSize,
        opacity: markerOpacity,
        color: markerColor ?? "#1f77b4",
      },
      // Raw points carry no name; the contour layer's colorbar is the
      // legend, and `showlegend: false` keeps the scatter trace from
      // duplicating itself in the legend frame.
      showlegend: false,
      hoverinfo: "x+y",
    } as unknown as PlotData,
    ...(hasData
      ? [
          {
            x,
            y,
            type: "histogram2dcontour",
            nbinsx,
            nbinsy,
            colorscale,
            // `contours.coloring`: "fill" = solid bands between iso-levels,
            // "lines" = just the iso-line strokes. The toggle is the user-
            // facing "fill the contour" checkbox.
            contours: { coloring: contourFill ? "fill" : "lines" },
            showscale: showColorbar,
            // Plotly 3.x uses the nested `title: { text, side }` shape;
            // the older `title: string, titleside: "right"` form is
            // silently dropped, which is why the user-supplied title
            // never appeared. The same shape is what the continuous-
            // color scatter / bubble paths already use.
            colorbar: colorbarTitle ? { title: { text: colorbarTitle, side: "right" } } : undefined,
            reversescale: reverseScale,
            // Slight transparency so the points beneath stay visible
            // through the contour fill.
            opacity: contourFill ? 0.6 : 1,
            hoverinfo: "skip",
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
