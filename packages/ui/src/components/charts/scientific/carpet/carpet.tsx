"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, SafeLayout } from "../../common";
import { PlotlyChart, createPlotlyConfig, getRenderer } from "../../common";

export interface CarpetSeriesData extends BaseSeries {
  a: number[];
  b: number[];
  x?: number[];
  y?: number[];
  aaxis?: {
    title?: string;
    tickmode?: "linear" | "array";
    tick0?: number;
    dtick?: number;
    tickvals?: number[];
    ticktext?: string[];
    gridcolor?: string;
    linecolor?: string;
    showgrid?: boolean;
    showline?: boolean;
  };
  baxis?: {
    title?: string;
    tickmode?: "linear" | "array";
    tick0?: number;
    dtick?: number;
    tickvals?: number[];
    ticktext?: string[];
    gridcolor?: string;
    linecolor?: string;
    showgrid?: boolean;
    showline?: boolean;
  };
}

export interface CarpetScatterSeriesData extends BaseSeries {
  a: number[];
  b: number[];
  carpet?: string; // Reference to carpet trace
  mode?: "markers" | "lines" | "lines+markers";
  marker?: {
    size?: number | number[];
    color?: string | string[] | number | number[];
    colorscale?: string | Array<[number, string]>;
    showscale?: boolean;
    symbol?: string | string[];
    line?: {
      width?: number;
      color?: string;
    };
  };
  line?: {
    width?: number;
    color?: string;
    dash?: string;
  };
}

export interface CarpetContourSeriesData extends BaseSeries {
  z: number[][];
  a: number[];
  b: number[];
  carpet?: string; // Reference to carpet trace
  colorscale?: string | Array<[number, string]>;
  showscale?: boolean;
  colorbar?: {
    title?: string;
    titleside?: "right" | "top" | "bottom";
    thickness?: number;
    len?: number;
  };
  contours?: {
    start?: number;
    end?: number;
    size?: number;
    showlines?: boolean;
    showlabels?: boolean;
    coloring?: "fill" | "lines" | "none";
  };
  ncontours?: number;
}

export interface CarpetPlotProps extends BaseChartProps {
  carpetData: CarpetSeriesData[];
  scatterData?: CarpetScatterSeriesData[];
  contourData?: CarpetContourSeriesData[];
}

export function CarpetPlot({
  carpetData,
  scatterData = [],
  contourData = [],
  config = {},
  className,
  loading,
  error,
}: CarpetPlotProps) {
  const renderer = getRenderer(config.useWebGL);

  const plotData: PlotData[] = [
    // Carpet traces
    ...carpetData.map(
      (series, index) =>
        ({
          a: series.a,
          b: series.b,
          x: series.x,
          y: series.y,
          name: series.name || `Carpet ${index + 1}`,
          type: "carpet",
          carpet: `carpet${index + 1}`, // Add carpet ID

          aaxis: series.aaxis
            ? {
                title: series.aaxis.title || "A",
                tickmode: series.aaxis.tickmode || "linear",
                tick0: series.aaxis.tick0 || 0,
                dtick: series.aaxis.dtick || 1,
                tickvals: series.aaxis.tickvals,
                ticktext: series.aaxis.ticktext,
                gridcolor: series.aaxis.gridcolor || "#E6E6E6",
                linecolor: series.aaxis.linecolor || "#444",
                showgrid: series.aaxis.showgrid !== false,
                showline: series.aaxis.showline !== false,
              }
            : {
                title: "A",
                gridcolor: "#E6E6E6",
                linecolor: "#444",
              },

          baxis: series.baxis
            ? {
                title: series.baxis.title || "B",
                tickmode: series.baxis.tickmode || "linear",
                tick0: series.baxis.tick0 || 0,
                dtick: series.baxis.dtick || 1,
                tickvals: series.baxis.tickvals,
                ticktext: series.baxis.ticktext,
                gridcolor: series.baxis.gridcolor || "#E6E6E6",
                linecolor: series.baxis.linecolor || "#444",
                showgrid: series.baxis.showgrid !== false,
                showline: series.baxis.showline !== false,
              }
            : {
                title: "B",
                gridcolor: "#E6E6E6",
                linecolor: "#444",
              },

          visible: series.visible,
          showlegend: series.showlegend,
          legendgroup: series.legendgroup,
        }) as any as PlotData,
    ),

    // Scatter traces on carpet coordinates
    ...scatterData.map(
      (series, index) =>
        ({
          a: series.a,
          b: series.b,
          name: series.name || `Scatter ${index + 1}`,
          type: "scattercarpet",
          carpet: series.carpet || `carpet${index + 1}`,
          mode: series.mode || "markers",

          marker: series.marker
            ? {
                size: series.marker.size || 8,
                color: series.marker.color,
                colorscale: series.marker.colorscale,
                showscale: series.marker.showscale || false,
                symbol: series.marker.symbol || "circle",
                line: series.marker.line
                  ? {
                      width: series.marker.line.width || 1,
                      color: series.marker.line.color || "#444",
                    }
                  : undefined,
              }
            : {
                size: 8,
                color: "#1f77b4",
              },

          line: series.line
            ? {
                width: series.line.width || 2,
                color: series.line.color,
                dash: series.line.dash,
              }
            : undefined,

          visible: series.visible,
          showlegend: series.showlegend !== false,
          legendgroup: series.legendgroup,
        }) as any as PlotData,
    ),

    // Contour traces
    ...contourData.map(
      (series, index) =>
        ({
          z: series.z,
          a: series.a,
          b: series.b,
          name: series.name || `Contour ${index + 1}`,
          type: "contourcarpet",
          carpet: series.carpet || `carpet${index + 1}`,

          colorscale: series.colorscale || "Viridis",
          showscale: series.showscale !== false,
          colorbar: series.colorbar || {
            title: "Value",
            titleside: "right",
          },

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

          visible: series.visible,
          showlegend: series.showlegend,
          legendgroup: series.legendgroup,
        }) as any as PlotData,
    ),
  ];

  // Create layout
  const layout = {
    title: config.title ? { text: config.title } : undefined,
    paper_bgcolor: config.backgroundColor || "white",
    showlegend: config.showLegend !== false,
    autosize: true,
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

// Carpet plot with contour overlay
export interface CarpetContourProps extends BaseChartProps {
  aValues: number[];
  bValues: number[];
  xGrid: number[][];
  yGrid: number[][];
  zGrid: number[][];
  aTitle?: string;
  bTitle?: string;
  colorscale?: string;
  carpetName?: string;
  contourName?: string;
}

export function CarpetContour({
  aValues,
  bValues,
  xGrid,
  yGrid,
  zGrid,
  aTitle = "A",
  bTitle = "B",
  colorscale = "Viridis",
  carpetName = "Carpet",
  contourName = "Contour",
  ...props
}: CarpetContourProps) {
  // Flatten grids for carpet plot
  const a: number[] = [];
  const b: number[] = [];
  const x: number[] = [];
  const y: number[] = [];

  for (let i = 0; i < aValues.length; i++) {
    for (let j = 0; j < bValues.length; j++) {
      a.push(aValues[i]!);
      b.push(bValues[j]!);
      x.push(xGrid[i]![j]!);
      y.push(yGrid[i]![j]!);
    }
  }

  return (
    <CarpetPlot
      carpetData={[
        {
          a: a,
          b: b,
          x: x,
          y: y,
          name: carpetName,
          aaxis: { title: aTitle },
          baxis: { title: bTitle },
        },
      ]}
      contourData={[
        {
          a: aValues,
          b: bValues,
          z: zGrid,
          name: contourName,
          colorscale: colorscale,
          carpet: "carpet1",
        },
      ]}
      {...props}
    />
  );
}
