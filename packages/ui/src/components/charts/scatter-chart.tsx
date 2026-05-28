"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries, LineConfig, MarkerConfig, ErrorBarConfig } from "./types";
import { useChartSizing } from "./use-is-compact";
import {
  createBaseLayout,
  createPlotlyConfig,
  getPlotType,
  getRenderer,
  refineAxisType,
} from "./utils";

export interface ScatterSeriesData extends BaseSeries {
  x: (string | number | Date)[];
  y: (string | number)[];
  mode?:
    | "markers"
    | "lines"
    | "lines+markers"
    | "markers+text"
    | "lines+markers+text"
    | "text"
    | "none";
  marker?: MarkerConfig;
  line?: LineConfig;
  text?: string | string[];
  textposition?:
    | "top left"
    | "top center"
    | "top right"
    | "middle left"
    | "middle center"
    | "middle right"
    | "bottom left"
    | "bottom center"
    | "bottom right";
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  error_x?: ErrorBarConfig;
  error_y?: ErrorBarConfig;
  fill?: "none" | "tozeroy" | "tozerox" | "tonexty" | "tonextx" | "toself" | "tonext";
  fillcolor?: string;
  // Bubble chart support
  size?: number[];
  sizemode?: "diameter" | "area";
  sizeref?: number;
  sizemin?: number;
}

export interface ScatterChartProps extends BaseChartProps {
  data: ScatterSeriesData[];
}

export function ScatterChart({ data, config = {}, className, loading, error }: ScatterChartProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  // Shrink the colorbar across responsive tiers; title font, tick font,
  // thickness and length all sit alongside the plot area and steal
  // horizontal room from a small chart.
  const adaptColorbar = (cb: NonNullable<ScatterSeriesData["marker"]>["colorbar"]) => {
    if (!cb) return undefined;
    if (!sizing.snug) return cb;
    const tickFontSize = sizing.veryCompact ? 8 : sizing.compact ? 9 : 11;
    const titleFontSize = sizing.veryCompact ? 8 : sizing.compact ? 9 : 11;
    const thickness = sizing.veryCompact ? 6 : sizing.compact ? 8 : 12;
    const len = sizing.veryCompact ? 0.5 : sizing.compact ? 0.6 : 0.8;
    return {
      ...cb,
      thickness,
      len,
      tickfont: { ...(cb as { tickfont?: { size?: number } }).tickfont, size: tickFontSize },
      title: cb.title
        ? {
            ...cb.title,
            font: { ...cb.title.font, size: titleFontSize },
          }
        : undefined,
    };
  };

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: series.x,
        y: series.y,
        name: series.name,
        type: plotType,
        mode: series.mode || "markers",

        marker: {
          color: series.marker?.color || series.color,
          size: series.size || series.marker?.size || 8,
          symbol: series.marker?.symbol || "circle",
          opacity: series.marker?.opacity || series.opacity || 0.8,
          colorscale: series.marker?.colorscale,
          showscale: series.marker?.showscale || false,
          colorbar: adaptColorbar(series.marker?.colorbar),
          line: series.marker?.line,
          sizemode: series.sizemode,
          sizeref: series.sizeref,
          sizemin: series.sizemin,
        },

        line:
          series.line && series.mode?.includes("lines")
            ? {
                color: series.line.color || series.color,
                width: series.line.width || 2,
                dash: series.line.dash || "solid",
                shape: series.line.shape || "linear",
                smoothing: series.line.smoothing,
              }
            : undefined,

        fill: series.fill || "none",
        fillcolor: series.fillcolor,

        text: series.text,
        textposition: series.textposition,
        textfont: series.textfont,

        error_x: series.error_x,
        error_y: series.error_y,

        opacity: series.opacity || 1,
        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as PlotData,
  );

  // Detect any continuous-color trace; its colorbar lives in the right
  // gutter, same column the default right-anchored legend wants. The
  // base layout uses this to either nudge the legend further right (full
  // size) or anchor it at the bottom (compact tiers).
  const hasColorbar = data.some((s) => s.marker?.showscale);
  const layout = createBaseLayout(config, { ...sizing, hasColorbar });
  const plotConfig = createPlotlyConfig(config, sizing);

  layout.xaxis = refineAxisType(
    layout.xaxis,
    data.flatMap((s) => s.x ?? []),
  );
  layout.yaxis = refineAxisType(
    layout.yaxis,
    data.flatMap((s) => s.y ?? []),
  );

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

// Bubble chart component (scatter with size encoding)
export interface BubbleChartProps extends BaseChartProps {
  data: Array<
    {
      x: (string | number | Date)[];
      y: (string | number)[];
      size: number[];
      color?: string | string[];
      name?: string;
      text?: string | string[];
      sizemode?: "diameter" | "area";
      sizeref?: number;
      sizemin?: number;
    } & BaseSeries
  >;
}

export function BubbleChart({ data, ...props }: BubbleChartProps) {
  return (
    <ScatterChart
      data={data.map((series) => ({
        ...series,
        mode: "markers" as const,
        sizemode: series.sizemode || "area",
        sizeref: series.sizeref,
        sizemin: series.sizemin,
      }))}
      {...props}
    />
  );
}
