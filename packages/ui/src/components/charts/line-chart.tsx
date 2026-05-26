"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import type { FacetGridConfig } from "./cartesian-chart";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries, LineConfig, MarkerConfig, ErrorBarConfig } from "./types";
import { facetTierStyles, useChartSizing } from "./use-is-compact";
import {
  applyReferenceLines,
  createBaseLayout,
  createPlotlyConfig,
  extendLayoutForFacets,
  getPlotType,
  getRenderer,
  refineAxisType,
} from "./utils";

export interface LineSeriesData extends BaseSeries {
  x: (string | number | Date)[];
  y: (string | number)[];
  /** Facet routing: pins this trace to a specific subplot cell. */
  xaxisId?: string;
  yaxisId?: string;
  mode?: "lines" | "markers" | "lines+markers" | "text" | "none";
  line?: LineConfig;
  marker?: MarkerConfig;
  fill?: "none" | "tozeroy" | "tozerox" | "tonexty" | "tonextx" | "toself" | "tonext";
  fillcolor?: string;
  connectgaps?: boolean;
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
}

export interface LineChartProps extends BaseChartProps {
  data: LineSeriesData[];
  /** Optional facet grid spec, same shape used by other faceted charts. */
  subplots?: FacetGridConfig;
}

export function LineChart({
  data,
  config = {},
  className,
  loading,
  error,
  subplots,
  ...eventHandlers
}: LineChartProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>(
    subplots ? { grid: { rows: subplots.rows, columns: subplots.columns } } : {},
  );
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  const plotData: PlotData[] = data.map((series, index) => {
    const mappedSeries = {
      x: series.x,
      y: series.y,
      xaxis: series.xaxisId,
      yaxis: series.yaxisId,
      name: series.name,
      type: plotType,
      mode: series.mode || "lines",

      line: {
        color: series.line?.color || series.color || "#1f77b4",
        width: series.line?.width || 2,
        dash: series.line?.dash || "solid",
        shape: series.line?.shape || "linear",
        smoothing: series.line?.smoothing,
      },

      marker:
        series.marker || series.mode?.includes("markers")
          ? {
              color: series.marker?.color || series.color,
              size: series.marker?.size || 6,
              symbol: series.marker?.symbol || "circle",
              opacity: series.marker?.opacity || series.opacity || 1,
              colorscale: series.marker?.colorscale,
              showscale: series.marker?.showscale || false,
              colorbar: series.marker?.colorbar,
              line: series.marker?.line,
            }
          : undefined,

      fill: series.fill || "none",
      fillcolor: series.fillcolor,
      connectgaps: series.connectgaps !== false,

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
    } as PlotData;

    return mappedSeries;
  });

  const layout = createBaseLayout(config, sizing);
  const plotConfig = createPlotlyConfig(config, sizing);

  layout.xaxis = refineAxisType(
    layout.xaxis,
    data.flatMap((s) => s.x ?? []),
  );
  layout.yaxis = refineAxisType(
    layout.yaxis,
    data.flatMap((s) => s.y ?? []),
  );

  // Faceted layout: convert single-axis xaxis/yaxis (now refined to the
  // right type) into a grid of numbered axes + per-cell title
  // annotations. Refining first lets the per-cell axis configs inherit
  // the auto-detected type.
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

  applyReferenceLines(layout, config.referenceLines, { cells: subplots?.cells });

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        data={plotData}
        layout={layout}
        config={plotConfig}
        loading={loading}
        error={error}
        {...eventHandlers}
      />
    </div>
  );
}
