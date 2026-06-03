"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries, MarkerConfig } from "./types";
import { useChartSizing } from "./use-is-compact";
import { createBaseLayout, createPlotlyConfig, getRenderer, getPlotType } from "./utils";

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
  /**
   * Trace-level line override. Only meaningful in stem mode (when
   * `marker.size === 0`); the wrapper switches the trace to `mode:
   * "lines"` and uses this for the stem's stroke. Used by `LollipopChart`
   * to expose the `stemWidth` prop end-to-end.
   */
  line?: {
    color?: string;
    width?: number;
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
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();
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
              color: series.line?.color ?? series.color,
              width: series.line?.width ?? 3,
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

  const layout = createBaseLayout(
    {
      ...config,
      // Adjust bargap for dot spacing
      xAxisType: config.xAxisType || (orientation === "h" ? "linear" : undefined),
      yAxisType: config.yAxisType || (orientation === "v" ? "linear" : undefined),
    },
    sizing,
  );

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

  const plotConfig = createPlotlyConfig(config, sizing);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
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

export { LollipopChart, type LollipopChartProps } from "./lollipop-chart";
