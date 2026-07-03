"use client";

import type { PlotData } from "plotly.js";
import React, { useMemo } from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries } from "./types";
import { useChartSizing } from "./use-is-compact";
import { createBaseLayout, createPlotlyConfig, getRenderer, getPlotType } from "./utils";

export interface ContourSeriesData extends BaseSeries {
  x?: (string | number | Date)[];
  y?: (string | number | Date)[];
  z: (string | number)[][];
  ncontours?: number;
  contours?: {
    start?: number;
    end?: number;
    size?: number;
    showlines?: boolean;
    showlabels?: boolean;
    labelfont?: {
      family?: string;
      size?: number;
      color?: string;
    };
    labelformat?: string;
    operation?: "=" | "<" | ">=" | ">" | "<=" | "[]" | "()";
    value?: number | number[];
    type?: "levels" | "constraint";
    coloring?: "fill" | "heatmap" | "lines" | "none";
  };
  colorscale?: string | Array<[number, string]>;
  /** Reverse the colorscale (Plotly `reversescale`). */
  reversescale?: boolean;
  showscale?: boolean;
  colorbar?: {
    /**
     * Plotly 3.x uses the nested `title: { text, side }` form. The older
     * top-level `title: string, titleside: "right"` shape is silently
     * dropped on render.
     */
    title?: { text?: string; side?: "right" | "top" | "bottom" };
    thickness?: number;
    len?: number;
    x?: number;
    y?: number;
  };
  line?: {
    color?: string;
    width?: number;
    dash?: string;
    smoothing?: number;
  };
  connectgaps?: boolean;
  smoothing?: number;
  autocontour?: boolean;
  transpose?: boolean;
}

export interface ContourPlotProps extends BaseChartProps {
  data: ContourSeriesData[];
  fillMode?: "none" | "toself" | "tonext";
}

export function ContourPlot({
  data,
  config = {},
  className,
  loading,
  error,
  fillMode = "none",
}: ContourPlotProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("contour", renderer);

  // react-plotly's `componentDidUpdate` decides whether to call
  // `Plotly.react` based on reference equality of `data` / `layout` /
  // `config` (factory.js:128). Any new reference (even deep-equal ones)
  // fires `Plotly.react`, which is buggy on contour traces (level-set
  // pathinfo gets reused with stale state, `makeCrossings` walks an
  // undefined entry). Memoizing keeps refs stable across spurious
  // parent re-renders.
  const plotData = useMemo<PlotData[]>(
    () =>
      data.map(
        (series) =>
          ({
            x: series.x,
            y: series.y,
            z: series.z,
            name: series.name,
            type: plotType,

            // Contour configuration
            ncontours: series.ncontours || 15,
            autocontour: series.autocontour !== false,
            contours: series.contours
              ? {
                  start: series.contours.start,
                  end: series.contours.end,
                  size: series.contours.size,
                  showlines: series.contours.showlines !== false,
                  showlabels: series.contours.showlabels || false,
                  labelfont: series.contours.labelfont || {
                    size: 12,
                    color: "black",
                  },
                  labelformat: series.contours.labelformat,
                  operation: series.contours.operation,
                  value: series.contours.value,
                  type: series.contours.type || "levels",
                  coloring: series.contours.coloring || "lines",
                }
              : {
                  showlines: true,
                  showlabels: false,
                  coloring: "lines",
                },

            // Color scale
            colorscale: series.colorscale || "Viridis",
            reversescale: series.reversescale === true,
            showscale: series.showscale !== false,
            colorbar: series.colorbar || {
              title: { text: "Level", side: "right" },
            },

            // Line styling
            line: series.line
              ? {
                  color: series.line.color,
                  width: series.line.width || 1,
                  dash: series.line.dash || "solid",
                  smoothing: series.line.smoothing || 1,
                }
              : {
                  width: 1,
                  smoothing: 1,
                },

            connectgaps: series.connectgaps !== false,
            smoothing: series.smoothing || 1,
            transpose: series.transpose || false,

            visible: series.visible,
            showlegend: series.showlegend,
            legendgroup: series.legendgroup,
            hovertemplate: series.hovertemplate,
            hoverinfo: series.hoverinfo,
            customdata: series.customdata,
          }) as any as PlotData,
      ),
    [data, plotType],
  );

  const layout = useMemo(() => createBaseLayout(config, sizing), [config, sizing]);
  const plotConfig = useMemo(() => createPlotlyConfig(config, sizing), [config, sizing]);

  // When the configuration genuinely changes, `config` identity flips
  // and `layout` / `plotConfig` recompute; react-plotly would call
  // `Plotly.react` and crash. The only safe path is a clean unmount and
  // remount, driven by a key that hashes the full config snapshot. One
  // frame of flicker per intentional change, no crash. Sizing-tier flips
  // remount for the same reason.
  const remountKey = useMemo(() => JSON.stringify({ config, sizing }), [config, sizing]);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        key={remountKey}
        data={plotData}
        layout={layout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}

// Overlay contour plot (contours over scatter/heatmap)
export interface OverlayContourProps extends BaseChartProps {
  baseData: any[]; // Base layer data (scatter, heatmap, etc.)
  contourData: ContourSeriesData[];
}

export function OverlayContour({
  baseData,
  contourData,
  config = {},
  className,
  loading,
  error,
}: OverlayContourProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();
  const renderer = getRenderer(config.useWebGL);
  const contourType = getPlotType("contour", renderer);

  const contourPlotData: PlotData[] = useMemo(
    () =>
      contourData.map(
        (series) =>
          ({
            x: series.x,
            y: series.y,
            z: series.z,
            name: series.name,
            type: contourType,

            ncontours: series.ncontours || 15,
            contours: {
              ...series.contours,
              coloring: "lines",
              showlines: true,
            },

            line: {
              color: series.line?.color || "black",
              width: series.line?.width || 1,
            },

            showscale: false, // Don't show colorbar for overlay

            visible: series.visible,
            showlegend: series.showlegend,
            legendgroup: series.legendgroup,
            hovertemplate: series.hovertemplate,
            hoverinfo: series.hoverinfo,
            customdata: series.customdata,
          }) as any as PlotData,
      ),
    [contourData, contourType],
  );

  const allData = useMemo(() => [...baseData, ...contourPlotData], [baseData, contourPlotData]);

  const layout = useMemo(() => createBaseLayout(config, sizing), [config, sizing]);
  const plotConfig = useMemo(() => createPlotlyConfig(config, sizing), [config, sizing]);

  // Same remount guard as ContourPlot: config/sizing changes must remount
  // rather than let react-plotly call Plotly.react on contour traces.
  const remountKey = useMemo(() => JSON.stringify({ config, sizing }), [config, sizing]);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        key={remountKey}
        data={allData}
        layout={layout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}
