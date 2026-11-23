"use client";

import type { Layout, PlotData } from "plotly.js";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { AUTOSIZE_TOLERANCE, MIN_OUTER_PLOT_HEIGHT, withOuterLabels } from "./outer-labels";
import { PlotlyChart } from "./plotly-chart";
import {
  fitWindTicks,
  measurePolarLabel,
  polarDiameter,
  polarFontFamily,
  usePolarFontRevision,
} from "./polar-label-fit";
import type { BaseChartProps, BaseSeries, PlotlyChartConfig } from "./types";
import { useChartThemeRefresh } from "./use-chart-theme-refresh";
import { useChartSizing } from "./use-is-compact";
import type { ChartSizing } from "./use-is-compact";
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
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  const [containerRef, measuredSizing] = useChartSizing<HTMLDivElement>({
    trackWidth: "pixel",
    trackHeight: "pixel",
  });
  const [settledSize, setSettledSize] = useState<{
    sizing: ChartSizing;
    width?: number;
    height?: number;
  }>();
  useIsomorphicLayoutEffect(() => {
    if (!measuredSizing.height || settledSize?.sizing === measuredSizing) return;
    const commitSize = () => {
      const container = containerRef.current;
      // Plotly autosize preserves fractional CSS pixels in the grid.
      const styles = container ? getComputedStyle(container) : undefined;
      setSettledSize({
        sizing: measuredSizing,
        width: Number.parseFloat(styles?.width ?? "") || measuredSizing.viewportWidth,
        height: Number.parseFloat(styles?.height ?? "") || measuredSizing.height,
      });
    };
    if (!settledSize) {
      commitSize();
      return;
    }
    const timer = setTimeout(commitSize, 65);
    return () => clearTimeout(timer);
  }, [containerRef, measuredSizing, settledSize]);
  const sizing = settledSize?.sizing ?? measuredSizing;
  const fontRevision = usePolarFontRevision();
  const { width, snug, compact: compactTier, veryCompact, ultraCompact } = sizing;
  const chrome = useMemo(
    () => ({ width, snug, compact: compactTier, veryCompact, ultraCompact }),
    [width, snug, compactTier, veryCompact, ultraCompact],
  );
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
        sizing: chrome,
        traces: plotData,
        labels: { left: 40, right: 40, top: 32, bottom: 32 },
        radialTitle,
      });
      return {
        data: outer.data,
        layout: {
          ...outer.layout,
          // Plotly keys SVG ticks by font. Use the loaded family to refresh their positions.
          ...(fontRevision ? { font: { ...outer.layout.font, family: polarFontFamily() } } : {}),
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
    [
      config,
      plotData,
      directionTicks,
      fontSizes.tick,
      radialTitle,
      chrome,
      tickText,
      themeVersion,
      fontRevision,
    ],
  );

  const height = config.height ?? settledSize?.height ?? sizing.height ?? 0;
  const viewportWidth = config.width ?? settledSize?.width ?? sizing.viewportWidth ?? Infinity;
  const normalDiameter = polarDiameter(
    normal.layout as unknown as Partial<Layout>,
    viewportWidth,
    height,
  );
  const short = height > 0 && normalDiameter - AUTOSIZE_TOLERANCE < MIN_OUTER_PLOT_HEIGHT;
  const compactHeight = short ? height : 0;
  const figure = useMemo(() => {
    if (!compactHeight) return normal;
    const outer = withOuterLabels({
      config,
      sizing: chrome,
      traces: plotData,
      labels: { left: 40, right: 40, top: 22, bottom: 22 },
      radialTitle,
      compact: { height: compactHeight, maxPlotHeight: MIN_OUTER_PLOT_HEIGHT },
    });
    return {
      data: outer.data,
      layout: {
        ...outer.layout,
        font: normal.layout.font,
        barmode: normal.layout.barmode,
        polar: normal.layout.polar,
      },
    };
  }, [normal, config, chrome, plotData, radialTitle, compactHeight]);

  const peak = useMemo(() => {
    const counts = new Map<number, number>();
    for (const series of data) {
      if (series.visible === false || series.visible === "legendonly") continue;
      series.theta.forEach((angle, index) => {
        counts.set(angle, (counts.get(angle) ?? 0) + (series.r[index] ?? 0));
      });
    }
    return Math.max(0, ...counts.values());
  }, [data]);
  const labels = useMemo(
    () =>
      directionTicks.flatMap((angle, index) => {
        const text = tickText[index];
        return text ? [{ angle, text }] : [];
      }),
    [directionTicks, tickText],
  );

  const diameter = polarDiameter(
    figure.layout as unknown as Partial<Layout>,
    viewportWidth,
    height,
  );
  const measured = height > 0;
  const fit = useMemo(() => {
    if (!measured) return { step: 1, ticks: undefined };
    return fitWindTicks({
      diameter: Math.max(MIN_OUTER_PLOT_HEIGHT, diameter),
      peak,
      labels,
      size: fontSizes.tick,
      measure: measurePolarLabel,
      compact: short,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fontRevision invalidates the measured text.
  }, [measured, diameter, peak, labels, fontSizes.tick, short, fontRevision]);
  const radial = fit.ticks?.join(",");
  const tickLayout = useMemo(() => {
    if (fit.step === 1 && !radial) return figure.layout;
    const { polar } = figure.layout;
    const angles = new Set(
      labels.filter((_, index) => index % fit.step === 0).map(({ angle }) => angle),
    );
    const ticktext = tickText.map((text, index) =>
      angles.has(directionTicks[index] ?? NaN) ? text : "",
    );
    return {
      ...figure.layout,
      polar: {
        ...polar,
        angularaxis: fit.step === 1 ? polar.angularaxis : { ...polar.angularaxis, ticktext },
        radialaxis: radial
          ? {
              ...polar.radialaxis,
              tickmode: "array",
              tickvals: radial.split(",").map(Number),
              ticktext: radial.split(","),
            }
          : polar.radialaxis,
      },
    };
  }, [figure, fit.step, radial, labels, tickText, directionTicks]);
  // Commit the measured dimensions with their ticks. Plotly's autosize would draw them separately.
  const layout = useMemo(
    () =>
      height && Number.isFinite(viewportWidth)
        ? { ...tickLayout, width: viewportWidth, height, autosize: false }
        : tickLayout,
    [tickLayout, viewportWidth, height],
  );
  const plotConfig = useMemo(() => createPlotlyConfig(config, chrome), [config, chrome]);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        data={figure.data}
        layout={layout as unknown as Partial<Layout>}
        config={plotConfig}
        loading={loading || !settledSize}
        error={error}
      />
    </div>
  );
}
