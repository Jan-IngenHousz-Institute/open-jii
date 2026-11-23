"use client";

import type { Layout, PlotData } from "plotly.js";
import React, { useMemo } from "react";

import { cn } from "../../lib/utils";
import { withOuterLabels } from "./outer-labels";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries, PlotlyChartConfig } from "./types";
import { useChartThemeRefresh } from "./use-chart-theme-refresh";
import { useChartSizing } from "./use-is-compact";
import { usePolarLabelFit } from "./use-polar-label-fit";
import { createPlotlyConfig, responsiveChrome, tierAxisFontSizes, chartGridColor } from "./utils";

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
const DEFAULT_CONFIG: PlotlyChartConfig = {};

export function WindRose({
  data,
  config = DEFAULT_CONFIG,
  className,
  loading,
  error,
  directionLabels = DEFAULT_DIRECTION_LABELS,
  directionTicks = DEFAULT_DIRECTION_TICKS,
  radialAxisTitle = "Frequency",
}: WindRoseProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>({
    trackWidth: true,
    trackHeight: "pixel",
  });
  const themeVersion = useChartThemeRefresh();
  const fontSizes = tierAxisFontSizes(sizing);
  const plotData: PlotData[] = useMemo(
    () =>
      data.map(
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
      ),
    [data],
  );

  // Always tick at the same positions; just swap label text. Falling
  // back to `tickmode: "linear"` lets Plotly draw a tick at every degree,
  // which on a 360-period axis renders as a solid black ring of stacked
  // numbers. Snapping to the user-supplied tick set avoids that.
  const tickText = useMemo(
    () => (directionLabels.length > 0 ? directionLabels : directionTicks.map((deg) => `${deg}°`)),
    [directionLabels, directionTicks],
  );
  const radialTitle = useMemo(
    () => ({ text: radialAxisTitle, fontSize: fontSizes.axisTitle }),
    [radialAxisTitle, fontSizes.axisTitle],
  );
  const normal = useMemo(
    () => {
      const outer = withOuterLabels({
        config,
        sizing,
        traces: plotData,
        labels: { left: 40, right: 40, top: 32, bottom: 32 },
        radialTitle,
      });
      return {
        data: outer.data,
        layout: {
          ...outer.layout,
          barmode: "stack",
          polar: {
            bgcolor: "white",
            radialaxis: {
              title: { text: "" },
              tickfont: { size: fontSizes.tick },
              angle: 0,
              tickangle: 0,
              nticks: 5,
              gridcolor: chartGridColor(),
              showgrid: config.showGrid !== false,
            },
            angularaxis: {
              // Compass convention: 0° at top, sweep clockwise.
              direction: "clockwise",
              rotation: 90,
              period: 360,
              tickmode: "array",
              tickvals: directionTicks,
              ticktext: tickText,
              tickfont: { size: fontSizes.tick },
              gridcolor: chartGridColor(),
              showgrid: config.showGrid !== false,
            },
          },
        },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
    [config, plotData, directionTicks, fontSizes.tick, radialTitle, sizing, tickText, themeVersion],
  );

  const height = config.height ?? sizing.height ?? 0;
  const { compact, maxPlotHeight, onNormalDraw } = usePolarLabelFit(
    normal.layout as unknown as Partial<Layout>,
    height,
    // Full 32-label mode has its own larger catalogue minimum.
    tickText.filter(Boolean).length <= 16,
  );
  const figure = useMemo(() => {
    if (!compact) return normal;
    const labelStep = Math.ceil(directionTicks.length / 8);
    const outer = withOuterLabels({
      config,
      sizing,
      traces: plotData,
      labels: { left: 40, right: 40, top: 22, bottom: 22 },
      radialTitle,
      compact: { height, maxPlotHeight },
    });
    const { polar } = normal.layout;
    return {
      data: outer.data,
      layout: {
        ...outer.layout,
        barmode: normal.layout.barmode,
        polar: {
          ...polar,
          radialaxis: { ...polar.radialaxis, nticks: 2 },
          angularaxis: {
            ...polar.angularaxis,
            ticktext:
              labelStep > 1
                ? tickText.map((label, i) => (i % labelStep === 0 ? label : ""))
                : tickText,
          },
        },
      },
    };
  }, [
    compact,
    config,
    directionTicks.length,
    height,
    maxPlotHeight,
    normal,
    plotData,
    radialTitle,
    sizing,
    tickText,
  ]);

  const plotConfig = useMemo(() => createPlotlyConfig(config, sizing), [config, sizing]);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        data={figure.data}
        layout={figure.layout as unknown as Partial<Layout>}
        onInitialized={onNormalDraw}
        onUpdate={onNormalDraw}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}
