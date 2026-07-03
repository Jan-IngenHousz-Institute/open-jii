"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import type { FacetGridConfig } from "./cartesian-chart";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries } from "./types";
import { facetTierStyles, useChartSizing } from "./use-is-compact";
import {
  applyReferenceLines,
  createBaseLayout,
  createPlotlyConfig,
  extendLayoutForFacets,
  getRenderer,
  getPlotType,
  truncateCategoryTicks,
} from "./utils";

export interface BoxSeriesData extends BaseSeries {
  y?: (string | number)[];
  x?: (string | number | Date)[];
  /** Facet routing: pins this trace to a specific subplot cell. */
  xaxisId?: string;
  yaxisId?: string;
  q1?: number[];
  median?: number[];
  q3?: number[];
  lowerfence?: number[];
  upperfence?: number[];
  mean?: number[];
  sd?: number[];
  outliers?: number[];
  boxpoints?: "all" | "outliers" | "suspectedoutliers" | "false";
  jitter?: number;
  pointpos?: number;
  fillcolor?: string;
  line?: {
    color?: string;
    width?: number;
  };
  marker?: {
    color?: string;
    size?: number;
    opacity?: number;
    outliercolor?: string;
    line?: {
      color?: string;
      width?: number;
      outliercolor?: string;
      outlierwidth?: number;
    };
  };
  notched?: boolean;
  notchwidth?: number;
  boxmean?: boolean | "sd";
  orientation?: "v" | "h";
}

export interface BoxPlotProps extends BaseChartProps {
  data: BoxSeriesData[];
  orientation?: "v" | "h";
  boxmode?: "group" | "overlay";
  /** Optional facet grid spec, same shape used by other faceted charts. */
  subplots?: FacetGridConfig;
}

export function BoxPlot({
  data,
  config = {},
  className,
  loading,
  error,
  orientation = "v",
  boxmode = "group",
  subplots,
}: BoxPlotProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>(
    subplots ? { grid: { rows: subplots.rows, columns: subplots.columns } } : {},
  );
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("box", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        y: (series.orientation || orientation) === "v" ? series.y : series.x,
        x: (series.orientation || orientation) === "v" ? series.x : series.y,
        xaxis: series.xaxisId,
        yaxis: series.yaxisId,
        name: series.name,
        type: plotType,

        // Box statistics
        q1: series.q1,
        median: series.median,
        q3: series.q3,
        lowerfence: series.lowerfence,
        upperfence: series.upperfence,
        mean: series.mean,
        sd: series.sd,

        // Outliers and points
        boxpoints:
          series.boxpoints !== undefined && series.boxpoints !== "false"
            ? series.boxpoints
            : "outliers",
        jitter: series.jitter || 0.3,
        pointpos: series.pointpos || -1.8,

        // Dark default for line so box border, mean line, and notch outline
        // stay visible against the trace-color fill.
        fillcolor: series.fillcolor || series.color,
        line: {
          color: series.line?.color || "#444",
          width: series.line?.width || 1.5,
        },
        marker: {
          color: series.marker?.color || series.color,
          size: series.marker?.size || 6,
          opacity: series.marker?.opacity || series.opacity || 1,
          outliercolor: series.marker?.outliercolor,
          line: series.marker?.line
            ? {
                color: series.marker.line.color,
                width: series.marker.line.width || 1,
                outliercolor: series.marker.line.outliercolor,
                outlierwidth: series.marker.line.outlierwidth || 1,
              }
            : undefined,
        },

        // Box style
        notched: series.notched || false,
        notchwidth: series.notchwidth || 0.25,
        boxmean: series.boxmean || false,

        orientation: (series.orientation || orientation) === "h" ? "h" : "v",

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  const layout = createBaseLayout(config, sizing);
  layout.boxmode = boxmode;

  // Truncate category ticks before faceting so extendLayoutForFacets copies
  // the truncated template into every cell (xaxisN/yaxisN).
  const hasStringX = data.some(
    (series) => series.x && series.x.some((val) => typeof val === "string"),
  );
  const hasStringY = data.some(
    (series) => series.y && series.y.some((val) => typeof val === "string"),
  );

  if (hasStringX && orientation === "v") {
    layout.xaxis = truncateCategoryTicks(
      { ...layout.xaxis, type: "category" },
      data.flatMap((series) => series.x ?? []),
      sizing,
    );
  }

  if (hasStringY && orientation === "h") {
    layout.yaxis = truncateCategoryTicks(
      { ...layout.yaxis, type: "category" },
      data.flatMap((series) => series.y ?? []),
      sizing,
    );
  }

  // Faceted layout: same shape used by cartesian / histogram.
  if (subplots) {
    const { cellTitleFontSize } = facetTierStyles(sizing);
    const forceSharedTitles = sizing.cellVeryCompact;
    const effectiveSharedXTitle = forceSharedTitles || subplots.sharedXTitle === true;
    const effectiveSharedYTitle = forceSharedTitles || subplots.sharedYTitle === true;
    const faceted = extendLayoutForFacets(layout, subplots.cells, {
      rows: subplots.rows,
      columns: subplots.columns,
      sharedX: subplots.sharedX,
      sharedY: subplots.sharedY,
      sharedXTitle: effectiveSharedXTitle,
      sharedYTitle: effectiveSharedYTitle,
      roworder: subplots.roworder,
      titleFontSize: cellTitleFontSize,
      ultraCompactCells: sizing.cellUltraCompact,
    });
    Object.assign(layout, faceted);
  }

  applyReferenceLines(layout, config.referenceLines, { cells: subplots?.cells });

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

export { GroupedBoxPlot, type GroupedBoxPlotProps } from "./grouped-box-plot";
export { ViolinPlot, type ViolinPlotProps, type ViolinSeriesData } from "./violin-plot";
