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

export interface ParallelCoordinatesSeriesData extends BaseSeries {
  dimensions: Array<{
    label: string;
    values: (string | number)[];
    range?: [number, number];
    tickvals?: number[];
    ticktext?: string[];
    constraintrange?: [number, number] | Array<[number, number]>;
    multiselect?: boolean;
    visible?: boolean;
  }>;
  line?: {
    color?: (string | number)[] | string;
    colorscale?: string | Array<[number, string]>;
    showscale?: boolean;
    cmin?: number;
    cmax?: number;
    cmid?: number;
    colorbar?: {
      title?: string;
      titleside?: "right" | "top" | "bottom";
      thickness?: number;
      len?: number;
      x?: number;
      y?: number;
    };
    width?: number;
    opacity?: number;
  };
  labelangle?: number;
  labelside?: "top" | "bottom";
  rangefont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  tickfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
}

export interface ParallelCoordinatesProps extends BaseChartProps {
  data: ParallelCoordinatesSeriesData[];
}

export function ParallelCoordinates({
  data,
  config = {},
  className,
  loading,
  error,
}: ParallelCoordinatesProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("parcoords", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        name: series.name,
        type: plotType,

        // Dimensions configuration
        dimensions: series.dimensions.map((dim) => ({
          label: dim.label,
          values: dim.values,
          range: dim.range,
          tickvals: dim.tickvals,
          ticktext: dim.ticktext,
          constraintrange: dim.constraintrange,
          multiselect: dim.multiselect !== false,
          visible: dim.visible !== false,
        })),

        // Line configuration
        line: series.line
          ? {
              color: series.line.color || series.color,
              colorscale: series.line.colorscale || "Viridis",
              showscale: series.line.showscale !== false,
              cmin: series.line.cmin,
              cmax: series.line.cmax,
              cmid: series.line.cmid,
              colorbar: series.line.colorbar || {
                title: "Value",
                titleside: "right",
              },
              width: series.line.width || 1,
              opacity: series.line.opacity || series.opacity || 1,
            }
          : {
              color: series.color || "blue",
              width: 1,
            },

        // Label configuration
        labelangle: series.labelangle || 0,
        labelside: series.labelside || "top",
        rangefont: series.rangefont || {
          size: 12,
          color: "#444",
        },
        tickfont: series.tickfont || {
          size: 10,
          color: "#444",
        },

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

// Parallel categories plot (for categorical data)
export interface ParallelCategoriesSeriesData extends BaseSeries {
  dimensions: Array<{
    label: string;
    values: string[];
    categoryorder?: "trace" | "category ascending" | "category descending" | "array";
    categoryarray?: string[];
    ticktext?: string[];
    visible?: boolean;
  }>;
  line?: {
    color?: (string | number)[] | string;
    colorscale?: string | Array<[number, string]>;
    showscale?: boolean;
    cmin?: number;
    cmax?: number;
    shape?: "linear" | "hv" | "vh" | "hvh" | "vhv";
    colorbar?: {
      title?: string;
      titleside?: "right" | "top" | "bottom";
      thickness?: number;
      len?: number;
      x?: number;
      y?: number;
    };
  };
  counts?: number[];
  bundlecolors?: boolean;
  sortpaths?: "forward" | "backward";
  labelfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  tickfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
}

export interface ParallelCategoriesProps extends BaseChartProps {
  data: ParallelCategoriesSeriesData[];
}

export function ParallelCategories({
  data,
  config = {},
  className,
  loading,
  error,
}: ParallelCategoriesProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("parcats", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        name: series.name,
        type: plotType,

        // Dimensions configuration for categorical data
        dimensions: series.dimensions.map((dim) => ({
          label: dim.label,
          values: dim.values,
          categoryorder: dim.categoryorder || "trace",
          categoryarray: dim.categoryarray,
          ticktext: dim.ticktext,
          visible: dim.visible !== false,
        })),

        // Line configuration for parallel categories
        line: series.line
          ? {
              color: series.line.color,
              colorscale: series.line.colorscale || "Viridis",
              showscale: series.line.showscale !== false,
              cmin: series.line.cmin,
              cmax: series.line.cmax,
              shape: series.line.shape || "linear",
              colorbar: series.line.colorbar || {
                title: "Count",
                titleside: "right",
              },
            }
          : undefined,

        // Additional categorical plot properties
        counts: series.counts,
        bundlecolors: series.bundlecolors !== false,
        sortpaths: series.sortpaths || "forward",
        labelfont: series.labelfont || {
          size: 14,
          color: "#444",
        },
        tickfont: series.tickfont || {
          size: 12,
          color: "#444",
        },

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

// Alluvial diagram (flow between categories)
export interface AlluvialSeriesData extends BaseSeries {
  nodes: {
    label: string[];
    color?: string[];
    pad?: number;
    thickness?: number;
    line?: {
      color?: string;
      width?: number;
    };
  };
  links: {
    source: number[];
    target: number[];
    value: number[];
    color?: string[];
    label?: string[];
    hovertemplate?: string;
    line?: {
      color?: string;
      width?: number;
    };
  };
  orientation?: "v" | "h";
  valueformat?: string;
  valuesuffix?: string;
  arrangement?: "snap" | "perpendicular" | "freeform" | "fixed";
}

export interface AlluvialProps extends BaseChartProps {
  data: AlluvialSeriesData[];
}

export function Alluvial({ data, config = {}, className, loading, error }: AlluvialProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("sankey", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        name: series.name,
        type: plotType,

        node: {
          label: series.nodes.label,
          color: series.nodes.color || "lightblue",
          pad: series.nodes.pad || 15,
          thickness: series.nodes.thickness || 20,
          line: series.nodes.line || {
            color: "black",
            width: 0.5,
          },
        },

        link: {
          source: series.links.source,
          target: series.links.target,
          value: series.links.value,
          color: series.links.color || "rgba(128,128,128,0.2)",
          label: series.links.label,
          hovertemplate: series.links.hovertemplate,
          line: series.links.line || {
            color: "rgba(0,0,0,0.2)",
            width: 0,
          },
        },

        orientation: series.orientation || "h",
        valueformat: series.valueformat || ".0f",
        valuesuffix: series.valuesuffix || "",
        arrangement: series.arrangement || "snap",

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
