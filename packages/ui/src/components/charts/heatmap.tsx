"use client";

import type { PlotData } from "plotly.js";
import React, { useMemo } from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries } from "./types";
import { useChartThemeRefresh } from "./use-chart-theme-refresh";
import { useChartSizing } from "./use-is-compact";
import {
  createBaseLayout,
  createPlotlyConfig,
  detectAxisType,
  getRenderer,
  getPlotType,
  truncateCategoryTicks,
} from "./utils";

export interface HeatmapSeriesData extends BaseSeries {
  x?: (string | number | Date)[];
  y?: (string | number | Date)[];
  z: (string | number)[][];
  colorscale?: string | Array<[number, string]>;
  /** Reverse the colorscale (Plotly `reversescale`). */
  reversescale?: boolean;
  showscale?: boolean;
  zmid?: number;
  zmin?: number;
  zmax?: number;
  zauto?: boolean;
  /**
   * Cell-edge interpolation. `false` keeps the discrete-cell heatmap
   * look; `"best"`/`"fast"` smooth the transitions for a gradient
   * appearance. Plotly defaults to `false` on `heatmap`, which is the
   * canonical academic look; surfacing this so a dense matrix can opt
   * into smoothing without leaving the heatmap chart family.
   */
  zsmooth?: false | "best" | "fast";
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
    tickmode?: "linear" | "array";
    tick0?: number;
    dtick?: number;
    tickvals?: number[];
    ticktext?: string[];
    tickformat?: string;
  };
  text?: string[][];
  texttemplate?: string;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  hoverongaps?: boolean;
  /**
   * Off by default: a missing cell stays blank instead of taking a value
   * interpolated from its neighbours, which for a presence matrix would
   * invent readings that never happened.
   */
  connectgaps?: boolean;
  xgap?: number;
  ygap?: number;
  transpose?: boolean;
}

export interface HeatmapProps extends BaseChartProps {
  data: HeatmapSeriesData[];
  aspectRatio?: "auto" | "equal";
}

export function Heatmap({
  data,
  config = {},
  className,
  loading,
  error,
  aspectRatio = "auto",
}: HeatmapProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();
  const themeVersion = useChartThemeRefresh();
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("heatmap", renderer);

  const plotData: PlotData[] = useMemo(
    () =>
      data.map((series) => {
        return {
          x: series.x,
          y: series.y,
          z: series.z,
          name: series.name,
          type: plotType,

          // Color scale configuration - only set if provided
          colorscale: series.colorscale,
          reversescale: series.reversescale === true,
          showscale: series.showscale,
          zmid: series.zmid,
          zmin: series.zmin,
          zmax: series.zmax,
          zauto: series.zauto !== false,
          zsmooth: series.zsmooth ?? false,

          // Color bar uses Plotly 3.x nested form.
          colorbar: series.colorbar || {
            title: { text: "Value", side: "right" },
          },

          // Text annotations
          text: series.text,
          texttemplate: series.texttemplate,
          textfont: series.textfont,

          // Gaps and layout
          hoverongaps: series.hoverongaps !== false,
          connectgaps: series.connectgaps === true,
          xgap: series.xgap || 1,
          ygap: series.ygap || 1,
          transpose: series.transpose || false,

          visible: series.visible,
          showlegend: series.showlegend,
          legendgroup: series.legendgroup,
          hovertemplate: series.hovertemplate,
          hoverinfo: series.hoverinfo,
          customdata: series.customdata,
        } as any as PlotData;
      }),
    [data, plotType],
  );

  const layout = useMemo(() => {
    const next = createBaseLayout(config, sizing);

    const firstSeries = data[0];
    const xValues = firstSeries?.x ?? [];
    const yValues = firstSeries?.y ?? [];

    // ISO timestamps get a date axis so Plotly ticks at sensible intervals
    // instead of one rotated label per bucket.
    const xAxisType = detectAxisType(xValues);
    const yAxisType = detectAxisType(yValues);

    // Bound long category labels so automargin can't eat the plot area.
    next.xaxis = truncateCategoryTicks({ ...next.xaxis, type: xAxisType }, xValues, sizing);
    next.yaxis = truncateCategoryTicks({ ...next.yaxis, type: yAxisType }, yValues, sizing);

    // Set aspect ratio if specified
    if (aspectRatio === "equal") {
      (next as any).yaxis = {
        ...(next as any).yaxis,
        scaleanchor: "x",
        scaleratio: 1,
      };
    }

    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
  }, [config, sizing, data, aspectRatio, themeVersion]);

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

export { CorrelationMatrix, type CorrelationMatrixProps } from "./correlation-matrix";
