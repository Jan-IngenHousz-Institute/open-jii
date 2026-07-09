"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries } from "./types";
import { useChartSizing } from "./use-is-compact";
import { createPlotlyConfig, responsiveChrome, tierAxisFontSizes } from "./utils";

/**
 * Wind-rose series. Each series represents one **value band** (e.g.
 * "0–2 m/s", "2–4 m/s"). The renderer feeding this wrapper bins both
 * direction and value, then emits one series per value band with:
 *   - `r[i]` = count of rows in (direction-bin i, this-value-band)
 *   - `theta[i]` = centre angle (degrees) of direction bin i
 * All series share the same `theta`, and stacking is handled by
 * Plotly's `barmode: "stack"` on the polar subplot.
 */
export interface WindRoseSeriesData extends BaseSeries {
  r: number[];
  theta: number[];
  /** Width of each angular slice in degrees. Defaults to 360 / N. */
  width?: number | number[];
  marker?: {
    color?: string;
    line?: {
      color?: string;
      width?: number;
    };
  };
}

export interface WindRoseProps extends BaseChartProps {
  data: WindRoseSeriesData[];
  /**
   * Compass-style direction labels matched 1:1 with `directionTicks`.
   * Pass an empty array to render the same tick positions as degree
   * labels (`0°`, `45°`, ...) rather than compass abbreviations.
   */
  directionLabels?: string[];
  /**
   * Tick positions (degrees). Defaults to 8-point compass:
   * `[0, 45, 90, 135, 180, 225, 270, 315]`. The wrapper uses these
   * positions for ticks regardless of whether `directionLabels` is
   * populated, so toggling labels off doesn't fall back to Plotly's
   * default per-degree ticks (which stack into a black ring).
   */
  directionTicks?: number[];
  /**
   * Radial-axis title. Defaults to "Frequency" since wind roses always
   * encode count of observations on r. Caller passes a translated string.
   */
  radialAxisTitle?: string;
}

const DEFAULT_DIRECTION_TICKS = [0, 45, 90, 135, 180, 225, 270, 315];
const DEFAULT_DIRECTION_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function WindRose({
  data,
  config = {},
  className,
  loading,
  error,
  directionLabels = DEFAULT_DIRECTION_LABELS,
  directionTicks = DEFAULT_DIRECTION_TICKS,
  radialAxisTitle = "Frequency",
}: WindRoseProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();
  const fontSizes = tierAxisFontSizes(sizing);
  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        type: "barpolar",
        r: series.r,
        theta: series.theta,
        width: series.width,
        name: series.name,

        marker: {
          color:
            (series.marker?.color as string | undefined) ??
            (typeof series.color === "string" ? series.color : undefined),
          line: series.marker?.line
            ? {
                color: series.marker.line.color,
                width: series.marker.line.width ?? 0,
              }
            : undefined,
        },

        opacity: series.opacity,
        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as unknown as PlotData,
  );

  // Always tick at the same positions; just swap label text. Falling
  // back to `tickmode: "linear"` lets Plotly draw a tick at every degree,
  // which on a 360-period axis renders as a solid black ring of stacked
  // numbers. Snapping to the user-supplied tick set avoids that.
  const tickText =
    directionLabels.length > 0 ? directionLabels : directionTicks.map((deg) => `${deg}°`);

  // Tier-aware chrome + the polar config createBaseLayout cannot provide.
  const layout = {
    ...responsiveChrome(config, sizing),
    // Stack value-band segments within each direction slice (the
    // canonical wind-rose rendering). `barmode: "stack"` is read by
    // both cartesian bar traces and barpolar.
    barmode: "stack",
    polar: {
      bgcolor: "white",
      radialaxis: {
        title: { text: radialAxisTitle, font: { size: fontSizes.axisTitle } },
        tickfont: { size: fontSizes.tick },
        // East-pointing radial axis: avoids the north overlap with bars.
        angle: 0,
        tickangle: 0,
        // Cap ticks so labels don't collide on small charts.
        nticks: 5,
        gridcolor: "#E6E6E6",
        showgrid: config.showGrid !== false,
      },
      angularaxis: {
        // Compass convention: 0° at top, sweep clockwise. Hard-coded
        // because that's the chart's defining layout.
        direction: "clockwise",
        rotation: 90,
        period: 360,
        tickmode: "array",
        tickvals: directionTicks,
        ticktext: tickText,
        tickfont: { size: fontSizes.tick },
        gridcolor: "#E6E6E6",
        showgrid: config.showGrid !== false,
      },
    },
  } as unknown as Partial<import("plotly.js").Layout>;

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
