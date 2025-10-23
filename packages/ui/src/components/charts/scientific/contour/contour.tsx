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
  showscale?: boolean;
  colorbar?: {
    title?: string;
    titleside?: "right" | "top" | "bottom";
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
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("contour", renderer);

  const plotData: PlotData[] = data.map(
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
        showscale: series.showscale !== false,
        colorbar: series.colorbar || {
          title: "Level",
          titleside: "right",
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
  const renderer = getRenderer(config.useWebGL);
  const contourType = getPlotType("contour", renderer);

  // Convert contour data to plot data
  const contourPlotData: PlotData[] = contourData.map(
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
  );

  // Combine base data with contour overlay
  const allData = [...baseData, ...contourPlotData];

  const layout = createBaseLayout(config);
  const plotConfig = createPlotlyConfig(config);

  return (
    <div className={className}>
      <PlotlyChart
        data={allData}
        layout={layout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}
