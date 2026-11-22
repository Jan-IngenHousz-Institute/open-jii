"use client";

import type { PlotData } from "plotly.js";
import React, { useMemo } from "react";

import { cn } from "../../lib/utils";
import { chartTextWidth, wrapChartLabel } from "./outer-labels";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries } from "./types";
import { useChartThemeRefresh } from "./use-chart-theme-refresh";
import { useChartSizing } from "./use-is-compact";
import {
  createBaseLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
  readThemeColor,
  chartGridColor,
  tierAxisFontSizes,
} from "./utils";

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
    /** Reverse the colorscale (Plotly `reversescale`). */
    reversescale?: boolean;
    showscale?: boolean;
    cmin?: number;
    cmax?: number;
    cmid?: number;
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
      /**
       * `tickmode: "array"` plus `tickvals`/`ticktext` lets a categorical
       * encoding show category *names* on the colorbar instead of the
       * synthesised integer indices the parcoords trace requires under
       * the hood. Required for any non-numeric color column.
       */
      tickmode?: "linear" | "array";
      tickvals?: number[];
      ticktext?: string[];
      /**
       * Font for the tick labels. Smaller sizes pack more category
       * names into the colorbar without overlap when the encoding has
       * a lot of unique values.
       */
      tickfont?: { family?: string; size?: number; color?: string };
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

const ROTATED_LABEL_WIDTH = 112;
const HEADING_EDGE_PADDING = 12;
// Plotly offsets a parcoords heading 28 px from its axis endpoint.
const ROTATED_HEADING_OFFSET = 28;

function fitParallelHeadings(
  data: ParallelCoordinatesSeriesData[],
  chartWidth: number,
  fontSize: number,
  margin: { l: number; r: number },
  edgePadding: number,
) {
  const widths = data.map((series) =>
    series.dimensions
      .filter((dim) => dim.visible !== false)
      .map((dim) => chartTextWidth(dim.label, fontSize))
      .sort((a, b) => b - a),
  );
  const widest = Math.max(0, ...widths.map((series) => series[0] ?? 0));
  const edge = widest / 2 + edgePadding;
  const axisWidth = chartWidth - Math.max(margin.l, edge) - Math.max(margin.r, edge);
  return {
    fontSize,
    edge,
    mustRotate: widths.some(
      ([first = 0, second, ...rest], index) =>
        !data[index]?.labelangle &&
        second !== undefined &&
        (first + second) / 2 + 3 > axisWidth / (rest.length + 1),
    ),
  };
}

export function ParallelCoordinates({
  data,
  config = {},
  className,
  loading,
  error,
}: ParallelCoordinatesProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>({ trackWidth: true });
  const themeVersion = useChartThemeRefresh();
  const fontSizes = tierAxisFontSizes(sizing);
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("parcoords", renderer);

  const base = useMemo(
    () => createBaseLayout(config, sizing),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
    [config, sizing, themeVersion],
  );
  const {
    fontSize,
    edge,
    mustRotate: rotateLabels,
  } = useMemo(() => {
    const width = config.width || sizing.width || Infinity;
    const margin = { l: base.margin?.l ?? 0, r: base.margin?.r ?? 0 };
    const regular = fitParallelHeadings(
      data,
      width,
      fontSizes.axisTitle,
      margin,
      HEADING_EDGE_PADDING,
    );
    if (!regular.mustRotate) return regular;

    const tighter = fitParallelHeadings(data, width, fontSizes.axisTitle - 1, margin, 4);
    return tighter.mustRotate ? regular : tighter;
  }, [base.margin, config.width, data, fontSizes.axisTitle, sizing.width]);

  const labelledSeries = useMemo(
    () =>
      data.map((series) =>
        rotateLabels && !series.labelangle
          ? {
              ...series,
              dimensions: series.dimensions.map((dim) =>
                dim.visible === false
                  ? dim
                  : { ...dim, label: wrapChartLabel(dim.label, fontSize, ROTATED_LABEL_WIDTH) },
              ),
            }
          : series,
      ),
    [data, fontSize, rotateLabels],
  );

  const plotData: PlotData[] = useMemo(
    () =>
      labelledSeries.map(
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
                  reversescale: series.line.reversescale === true,
                  showscale: series.line.showscale !== false,
                  cmin: series.line.cmin,
                  cmax: series.line.cmax,
                  cmid: series.line.cmid,
                  colorbar: series.line.colorbar || {
                    title: { text: "Value", side: "right" },
                  },
                  width: series.line.width || 1,
                  opacity: series.line.opacity || series.opacity || 1,
                }
              : {
                  color: series.color || "blue",
                  width: 1,
                },

            // Label configuration; defaults shrink with the container tier.
            labelangle: series.labelangle || (rotateLabels ? 90 : 0),
            labelside: series.labelside || "top",
            labelfont: { size: fontSize },
            rangefont: series.rangefont || {
              size: Math.min(12, fontSizes.tick),
              color: readThemeColor("--foreground") ?? "#444",
            },
            tickfont: series.tickfont || {
              size: Math.min(10, fontSizes.tick),
              color: readThemeColor("--foreground") ?? "#444",
            },

            visible: series.visible,
            showlegend: series.showlegend,
            legendgroup: series.legendgroup,
            hovertemplate: series.hovertemplate,
            hoverinfo: series.hoverinfo,
            customdata: series.customdata,
          }) as any as PlotData,
      ),
    [fontSize, fontSizes.tick, labelledSeries, plotType, rotateLabels],
  );

  const layout = useMemo(() => {
    const margin = {
      ...base.margin,
      l: Math.max(base.margin?.l ?? 0, rotateLabels ? 0 : edge),
      r: Math.max(base.margin?.r ?? 0, rotateLabels ? 0 : edge),
      t: Math.max(base.margin?.t ?? 0, (config.title ? 72 : 40) + fontSizes.axisTitle),
      b: Math.max(base.margin?.b ?? 0, 32),
    };
    if (rotateLabels) {
      for (const series of labelledSeries) {
        const labels = series.dimensions
          .filter((dim) => dim.visible !== false)
          .map((dim) => dim.label);
        const longestLine = Math.max(0, ...labels.map((label) => chartTextWidth(label, fontSize)));
        if (series.labelangle) {
          const edge = HEADING_EDGE_PADDING + longestLine / 2;
          margin.l = Math.max(margin.l, edge);
          margin.r = Math.max(margin.r, edge);
          continue;
        }

        const maxLines = Math.max(0, ...labels.map((label) => label.split("<br>").length));
        const sideMargin = HEADING_EDGE_PADDING + maxLines * fontSize * 1.3;
        margin.l = Math.max(margin.l, sideMargin);
        margin.r = Math.max(margin.r, sideMargin);
        if (series.labelside === "bottom") {
          margin.b = Math.max(
            margin.b,
            longestLine + ROTATED_HEADING_OFFSET + HEADING_EDGE_PADDING,
          );
        } else {
          const topPadding = config.title ? 48 : HEADING_EDGE_PADDING;
          margin.t = Math.max(margin.t, longestLine + ROTATED_HEADING_OFFSET + topPadding);
        }
      }
    }
    return {
      ...base,
      ...(config.title
        ? {
            title: {
              ...base.title,
              yref: "container" as const,
              y: 1,
              yanchor: "top" as const,
              pad: { t: 8 },
            },
          }
        : {}),
      margin,
    };
  }, [base, config.title, edge, fontSize, fontSizes.axisTitle, labelledSeries, rotateLabels]);
  const plotConfig = useMemo(() => createPlotlyConfig(config, sizing), [config, sizing]);

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
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();
  const themeVersion = useChartThemeRefresh();
  const fontSizes = tierAxisFontSizes(sizing);
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("parcats", renderer);

  const plotData: PlotData[] = useMemo(
    () =>
      data.map(
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
              size: fontSizes.axisTitle,
              color: readThemeColor("--foreground") ?? "#444",
            },
            tickfont: series.tickfont || {
              size: fontSizes.tick,
              color: readThemeColor("--foreground") ?? "#444",
            },

            visible: series.visible,
            showlegend: series.showlegend,
            legendgroup: series.legendgroup,
            hovertemplate: series.hovertemplate,
            hoverinfo: series.hoverinfo,
            customdata: series.customdata,
          }) as any as PlotData,
      ),
    [data, fontSizes.axisTitle, fontSizes.tick, plotType],
  );

  const layout = useMemo(
    () => createBaseLayout(config, sizing),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
    [config, sizing, themeVersion],
  );
  const plotConfig = useMemo(() => createPlotlyConfig(config, sizing), [config, sizing]);

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
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();
  const themeVersion = useChartThemeRefresh();
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("sankey", renderer);

  const plotData: PlotData[] = useMemo(
    () =>
      data.map(
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
              color: series.links.color || `${readThemeColor("--muted-foreground") ?? "#808080"}33`,
              label: series.links.label,
              hovertemplate: series.links.hovertemplate,
              line: series.links.line || {
                color: chartGridColor(),
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
      ),
    [data, plotType],
  );

  const layout = useMemo(
    () => createBaseLayout(config, sizing),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
    [config, sizing, themeVersion],
  );
  const plotConfig = useMemo(() => createPlotlyConfig(config, sizing), [config, sizing]);

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
