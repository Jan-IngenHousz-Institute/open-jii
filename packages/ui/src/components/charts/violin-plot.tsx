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
  getPlotType,
  getRenderer,
} from "./utils";

export interface ViolinSeriesData extends BaseSeries {
  y?: (string | number)[];
  x?: (string | number | Date)[];
  /** Facet routing: pins this trace to a specific subplot cell. */
  xaxisId?: string;
  yaxisId?: string;
  bandwidth?: number;
  scalegroup?: string;
  scalemode?: "width" | "count";
  spanmode?: "soft" | "hard" | "manual";
  span?: [number, number];
  side?: "positive" | "negative" | "both";
  box?: {
    visible?: boolean;
    width?: number;
    fillcolor?: string;
    line?: {
      color?: string;
      width?: number;
    };
  };
  meanline?: {
    visible?: boolean;
    color?: string;
    width?: number;
  };
  points?: "all" | "outliers" | "suspectedoutliers" | false;
  jitter?: number;
  pointpos?: number;
  orientation?: "v" | "h";
  fillcolor?: string;
  line?: {
    color?: string;
    width?: number;
  };
  marker?: {
    size?: number;
    color?: string;
    opacity?: number;
    symbol?: string;
    line?: {
      color?: string;
      width?: number;
    };
  };
}

export interface ViolinPlotProps extends BaseChartProps {
  data: ViolinSeriesData[];
  orientation?: "v" | "h";
  violinmode?: "group" | "overlay";
  /** Optional facet grid spec, same shape used by other faceted charts. */
  subplots?: FacetGridConfig;
}

export function ViolinPlot({
  data,
  config = {},
  className,
  loading,
  error,
  orientation = "v",
  violinmode = "group",
  subplots,
}: ViolinPlotProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>(
    subplots ? { grid: { rows: subplots.rows, columns: subplots.columns } } : {},
  );
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("violin", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        y: (series.orientation || orientation) === "v" ? series.y : series.x,
        x: (series.orientation || orientation) === "v" ? series.x : series.y,
        xaxis: series.xaxisId,
        yaxis: series.yaxisId,
        name: series.name,
        type: plotType,

        bandwidth: series.bandwidth,
        scalegroup: series.scalegroup,
        scalemode: series.scalemode || "width",
        spanmode: series.spanmode || "soft",
        span: series.span,
        side: series.side || "both",

        box: series.box
          ? {
              visible: series.box.visible !== false,
              width: series.box.width || 0.25,
              fillcolor: series.box.fillcolor,
              line: series.box.line,
            }
          : { visible: true, width: 0.25 },

        meanline: series.meanline
          ? {
              visible: series.meanline.visible !== false,
              color: series.meanline.color,
              width: series.meanline.width || 2,
            }
          : { visible: true },

        points: series.points !== undefined ? series.points : false,
        jitter: series.jitter || 0.3,
        pointpos: series.pointpos || 0,

        marker: series.marker
          ? {
              size: series.marker.size || 6,
              color: series.marker.color || series.color,
              opacity: series.marker.opacity || 1,
              symbol: series.marker.symbol || "circle",
              line: series.marker.line,
            }
          : {
              size: 6,
              color: series.color,
            },

        fillcolor: series.fillcolor || series.color,
        line: series.line
          ? {
              color: series.line.color || series.color,
              width: series.line.width || 0.5,
            }
          : {
              color: series.color,
              width: 0.5,
            },

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
    });
    Object.assign(layout, faceted);
  }

  (layout as any).violinmode = violinmode;

  applyReferenceLines(layout, config.referenceLines, { cells: subplots?.cells });

  const plotConfig = createPlotlyConfig(config);

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
