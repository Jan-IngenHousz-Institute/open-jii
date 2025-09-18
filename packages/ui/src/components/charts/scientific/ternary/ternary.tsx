"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, MarkerConfig, SafeFont } from "../../common";
import { PlotlyChart, createPlotlyConfig, getRenderer, getPlotType } from "../../common";

export interface TernarySeriesData extends BaseSeries {
  a: number[];
  b: number[];
  c: number[];
  mode?:
    | "markers"
    | "lines"
    | "lines+markers"
    | "text"
    | "markers+text"
    | "lines+text"
    | "lines+markers+text";
  marker?: MarkerConfig & {
    symbol?: string;
    line?: {
      color?: string;
      width?: number;
    };
  };
  line?: {
    color?: string;
    width?: number;
    dash?: string;
    shape?: string;
    smoothing?: number;
  };
  text?: string | string[];
  textposition?: string;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  sum?: number; // For normalization (default 1)
}

export interface TernaryBoundary {
  a: number[];
  b: number[];
  c: number[];
  name: string;
  line?: {
    color?: string;
    width?: number;
    dash?: string;
  };
  fillcolor?: string;
  opacity?: number;
}

export interface TernaryPlotProps extends BaseChartProps {
  data: TernarySeriesData[];
  boundaries?: TernaryBoundary[]; // Add support for classification boundaries
  aaxis?: {
    title?: string | { text: string; font?: SafeFont };
    min?: number;
    max?: number;
    tick0?: number;
    dtick?: number;
    gridcolor?: string;
    linecolor?: string;
    showgrid?: boolean;
    showline?: boolean;
    showticklabels?: boolean;
  };
  baxis?: {
    title?: string | { text: string; font?: SafeFont };
    min?: number;
    max?: number;
    tick0?: number;
    dtick?: number;
    gridcolor?: string;
    linecolor?: string;
    showgrid?: boolean;
    showline?: boolean;
    showticklabels?: boolean;
  };
  caxis?: {
    title?: string | { text: string; font?: SafeFont };
    min?: number;
    max?: number;
    tick0?: number;
    dtick?: number;
    gridcolor?: string;
    linecolor?: string;
    showgrid?: boolean;
    showline?: boolean;
    showticklabels?: boolean;
  };
  sum?: number;
  bgcolor?: string;
}

export function TernaryPlot({
  data,
  config = {},
  className,
  loading,
  error,
  boundaries = [],
  aaxis = {},
  baxis = {},
  caxis = {},
  sum = 1,
  bgcolor = "white",
}: TernaryPlotProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatterternary", renderer);

  // Process main data series
  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        a: series.a,
        b: series.b,
        c: series.c,
        name: series.name,
        type: plotType,
        mode: series.mode || "markers",

        marker: series.marker
          ? {
              color: series.marker.color || series.color,
              size: series.marker.size || 8,
              symbol: series.marker.symbol || "circle",
              opacity: series.marker.opacity || series.opacity || 1,
              line: series.marker.line
                ? {
                    color: series.marker.line.color,
                    width: series.marker.line.width || 0,
                  }
                : undefined,
            }
          : {
              color: series.color,
              size: 8,
            },

        line: series.line
          ? {
              color: series.line.color || series.color,
              width: series.line.width || 2,
              dash: series.line.dash || "solid",
              shape: series.line.shape || "linear",
              smoothing: series.line.smoothing,
            }
          : undefined,

        text: series.text,
        textposition: series.textposition || "middle center",
        textfont: series.textfont,

        sum: series.sum || sum,

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  // Add boundary lines as additional traces
  const boundaryTraces: PlotData[] = boundaries.map(
    (boundary) =>
      ({
        a: boundary.a,
        b: boundary.b,
        c: boundary.c,
        name: boundary.name,
        type: plotType,
        mode: "lines",
        line: {
          color: boundary.line?.color || "#333",
          width: boundary.line?.width || 2,
          dash: boundary.line?.dash || "solid",
        },
        fill: "toself", // Fill the polygon to itself
        fillcolor: boundary.fillcolor,
        opacity: boundary.opacity || 1,
        showlegend: true, // Show region names in legend
        legendgroup: "regions", // Group regions together
        hoverinfo: "name", // Show region name on hover
        sum: sum,
      }) as any as PlotData,
  );

  // Combine all traces - boundaries first (background), then scatter points (foreground) for proper layering
  const allTraces = [...boundaryTraces, ...plotData];

  // Create ternary-specific layout using responsive base layout
  const baseLayout = {
    title: config.title ? { text: config.title } : undefined,
    // Remove fixed width/height to allow container-based sizing
    paper_bgcolor: config.backgroundColor || "white",
    plot_bgcolor: bgcolor,
    autosize: true, // Enable responsive sizing

    ternary: {
      sum: sum,
      aaxis: {
        title: typeof aaxis.title === "string" ? { text: aaxis.title } : aaxis.title || "A",
        min: aaxis.min || 0,
        max: aaxis.max || sum,
        tick0: aaxis.tick0 || 0,
        dtick: aaxis.dtick || sum / 10,
        gridcolor: aaxis.gridcolor || "#E6E6E6",
        linecolor: aaxis.linecolor || "#444",
        showgrid: aaxis.showgrid !== false,
        showline: aaxis.showline !== false,
        showticklabels: aaxis.showticklabels !== false,
      },
      baxis: {
        title: typeof baxis.title === "string" ? { text: baxis.title } : baxis.title || "B",
        min: baxis.min || 0,
        max: baxis.max || sum,
        tick0: baxis.tick0 || 0,
        dtick: baxis.dtick || sum / 10,
        gridcolor: baxis.gridcolor || "#E6E6E6",
        linecolor: baxis.linecolor || "#444",
        showgrid: baxis.showgrid !== false,
        showline: baxis.showline !== false,
        showticklabels: baxis.showticklabels !== false,
      },
      caxis: {
        title: typeof caxis.title === "string" ? { text: caxis.title } : caxis.title || "C",
        min: caxis.min || 0,
        max: caxis.max || sum,
        tick0: caxis.tick0 || 0,
        dtick: caxis.dtick || sum / 10,
        gridcolor: caxis.gridcolor || "#E6E6E6",
        linecolor: caxis.linecolor || "#444",
        showgrid: caxis.showgrid !== false,
        showline: caxis.showline !== false,
        showticklabels: caxis.showticklabels !== false,
      },
      bgcolor: bgcolor,
    },

    showlegend: config.showLegend !== false,
  } as any; // Layout type allows flexible property assignment

  const plotConfig = createPlotlyConfig(config);

  return (
    <div className={className}>
      <PlotlyChart
        data={allTraces}
        layout={baseLayout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}

// Ternary contour plot
export interface TernaryContourSeriesData extends BaseSeries {
  a: number[];
  b: number[];
  c: number[];
  z?: number[];
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
  ncontours?: number;
  contours?: {
    start?: number;
    end?: number;
    size?: number;
    showlines?: boolean;
    showlabels?: boolean;
    coloring?: "fill" | "lines" | "none";
  };
}

export interface TernaryContourProps extends BaseChartProps {
  data: TernaryContourSeriesData[];
  aaxis?: TernaryPlotProps["aaxis"];
  baxis?: TernaryPlotProps["baxis"];
  caxis?: TernaryPlotProps["caxis"];
  sum?: number;
}

export function TernaryContour({
  data,
  config = {},
  className,
  loading,
  error,
  aaxis = {},
  baxis = {},
  caxis = {},
  sum = 1,
}: TernaryContourProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("contourternary", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        a: series.a,
        b: series.b,
        c: series.c,
        z: series.z,
        name: series.name,
        type: plotType,

        // Color scale
        colorscale: series.colorscale || "Viridis",
        showscale: series.showscale !== false,
        colorbar: series.colorbar || {
          title: "Value",
          titleside: "right",
        },

        // Contour configuration
        ncontours: series.ncontours || 15,
        contours: series.contours
          ? {
              start: series.contours.start,
              end: series.contours.end,
              size: series.contours.size,
              showlines: series.contours.showlines !== false,
              showlabels: series.contours.showlabels || false,
              coloring: series.contours.coloring || "fill",
            }
          : {
              showlines: true,
              coloring: "fill",
            },

        sum: sum,

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  // Create ternary-specific layout (similar to TernaryPlot) with responsive sizing
  const layout = {
    title: config.title ? { text: config.title } : undefined,
    // Remove fixed width/height to allow container-based sizing
    paper_bgcolor: config.backgroundColor || "white",
    autosize: true, // Enable responsive sizing

    ternary: {
      sum: sum,
      aaxis: {
        title: aaxis.title || "A",
        min: aaxis.min || 0,
        max: aaxis.max || sum,
        tick0: aaxis.tick0 || 0,
        dtick: aaxis.dtick || sum / 10,
        gridcolor: aaxis.gridcolor || "#E6E6E6",
        linecolor: aaxis.linecolor || "#444",
        showgrid: aaxis.showgrid !== false,
        showline: aaxis.showline !== false,
      },
      baxis: {
        title: baxis.title || "B",
        min: baxis.min || 0,
        max: baxis.max || sum,
        tick0: baxis.tick0 || 0,
        dtick: baxis.dtick || sum / 10,
        gridcolor: baxis.gridcolor || "#E6E6E6",
        linecolor: baxis.linecolor || "#444",
        showgrid: baxis.showgrid !== false,
        showline: baxis.showline !== false,
      },
      caxis: {
        title: caxis.title || "C",
        min: caxis.min || 0,
        max: caxis.max || sum,
        tick0: caxis.tick0 || 0,
        dtick: caxis.dtick || sum / 10,
        gridcolor: caxis.gridcolor || "#E6E6E6",
        linecolor: caxis.linecolor || "#444",
        showgrid: caxis.showgrid !== false,
        showline: caxis.showline !== false,
      },
    },

    showlegend: config.showLegend !== false,
  } as any; // Layout type allows flexible property assignment

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
