"use client";

import type { Layout, PlotData } from "plotly.js";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import {
  AUTOSIZE_TOLERANCE,
  chartTextWidth,
  MIN_OUTER_PLOT_HEIGHT,
  withOuterLabels,
  wrapChartLabel,
} from "./outer-labels";
import { PlotlyChart } from "./plotly-chart";
import {
  fitCompactRadarTicks,
  formatRadialTick,
  linearTicks,
  measurePolarLabel,
  polarDiameter,
  polarFontFamily,
  radarLabelsCollide,
  usePolarFontRevision,
} from "./polar-label-fit";
import type { BaseChartProps, BaseSeries, PlotlyChartConfig } from "./types";
import { useChartThemeRefresh } from "./use-chart-theme-refresh";
import { useChartSizing } from "./use-is-compact";
import {
  createPlotlyConfig,
  getRenderer,
  getPlotType,
  tierAxisFontSizes,
  chartGridColor,
} from "./utils";

const DEFAULT_CONFIG: PlotlyChartConfig = {};

function radarLabelMargins(labels: string[], fontSize: number, compact = false) {
  const side = Math.max(32, ...labels.map((label) => chartTextWidth(label, fontSize) + 12));
  const angleStep = (2 * Math.PI) / labels.length;
  const vertical = (direction: number) =>
    Math.max(
      compact ? 24 : 32,
      ...labels.map((label, index) => {
        const lineHeight = label.split("<br>").length * fontSize * 1.3;
        const outward = compact ? (1 + direction * Math.cos(angleStep * index)) / 2 : 1;
        return lineHeight * outward + (compact ? 10 : 12);
      }),
    );
  return { left: side, right: side, top: vertical(1), bottom: vertical(-1) };
}

export interface RadarSeriesData extends BaseSeries {
  r: number[];
  theta: string[] | number[];
  mode?: "lines" | "markers" | "lines+markers" | "lines+markers+text";
  fill?: "none" | "toself" | "tonext";
  fillcolor?: string;
  opacity?: number;
  marker?: {
    color?: string;
    size?: number;
    symbol?: string;
    line?: {
      color?: string;
      width?: number;
    };
  };
  line?: {
    color?: string;
    width?: number;
    dash?: string;
    shape?: string;
  };
  text?: string | string[];
  textposition?: string;
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
}

export interface RadarPlotProps extends BaseChartProps {
  data: RadarSeriesData[];
  categories?: string[];
  rangeMode?: "normal" | "tozero" | "nonnegative";
  gridShape?: "circular" | "linear";
  showTickLabels?: boolean;
  tickAngle?: number;
  radialAxisVisible?: boolean;
  angularAxisVisible?: boolean;
}

export function RadarPlot({
  data,
  config = DEFAULT_CONFIG,
  className,
  loading,
  error,
  categories,
  rangeMode = "tozero",
  gridShape = "circular",
  showTickLabels = true,
  tickAngle = 0,
  radialAxisVisible = true,
  angularAxisVisible = true,
}: RadarPlotProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>({
    trackWidth: "pixel",
    trackHeight: "pixel",
  });
  const height = config.height ?? sizing.height ?? 0;
  const viewportWidth = config.width ?? sizing.viewportWidth ?? Infinity;
  const { width, snug, compact: compactTier, veryCompact, ultraCompact } = sizing;
  // Keep the current tick density during growth until the size stops changing.
  const [settledCompact, setSettledCompact] = useState<boolean>();
  useEffect(() => {
    if (!height) return;
    const timer = setTimeout(() => setSettledCompact(compactTier), 65);
    return () => clearTimeout(timer);
  }, [compactTier, height, viewportWidth]);
  const compactChrome = compactTier || settledCompact === true;
  const chrome = useMemo(
    () => ({ width, snug, compact: compactChrome, veryCompact, ultraCompact }),
    [width, snug, compactChrome, veryCompact, ultraCompact],
  );
  const themeVersion = useChartThemeRefresh();
  const fontRevision = usePolarFontRevision();
  const fontSizes = tierAxisFontSizes(chrome);
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatterpolar", renderer);

  const plotData: PlotData[] = useMemo(
    () =>
      data.map(
        (series) =>
          ({
            r: series.r,
            theta: series.theta,
            name: series.name,
            type: plotType,
            mode: series.mode || "lines+markers",

            fill: series.fill || "toself",
            fillcolor: series.fillcolor || series.color,

            marker: series.marker
              ? {
                  color: series.marker.color || series.color,
                  size: series.marker.size || 8,
                  symbol: series.marker.symbol || "circle",
                  line: series.marker.line
                    ? {
                        color: series.marker.line.color,
                        width: series.marker.line.width || 1,
                      }
                    : undefined,
                }
              : {
                  color: series.color,
                  size: 8,
                },

            line: series.line
              ? {
                  color: series.line.color || series.color,
                  width: series.line.width || 2,
                  dash: series.line.dash || "solid",
                  shape: series.line.shape || "linear",
                }
              : {
                  color: series.color,
                  width: 2,
                },

            text: series.text,
            textposition: series.textposition || "middle center",
            textfont: series.textfont,

            opacity: series.opacity,
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

  const inferredCategories = useMemo(() => {
    if (categories !== undefined) return undefined;
    const theta = data.flatMap((series) => [...series.theta]);
    if (!theta.length || !theta.every((value) => typeof value === "string")) return undefined;
    return [...new Set(theta)];
  }, [categories, data]);
  const axisCategories = categories ?? inferredCategories;

  const normal = useMemo(
    () => {
      const ticktext = axisCategories?.map((label) =>
        wrapChartLabel(label, fontSizes.tick, chrome.compact ? 72 : 96),
      );
      const outer = withOuterLabels({
        config,
        sizing: chrome,
        traces: plotData,
        labels: radarLabelMargins(ticktext ?? [], fontSizes.tick),
      });
      return {
        data: outer.data,
        layout: {
          ...outer.layout,
          // Plotly keys SVG ticks by font. Use the loaded family to refresh their positions.
          ...(fontRevision ? { font: { ...outer.layout.font, family: polarFontFamily() } } : {}),
          polar: {
            radialaxis: {
              visible: radialAxisVisible,
              range: rangeMode === "tozero" ? [0, undefined] : undefined,
              rangemode: rangeMode,
              nticks: chrome.compact ? 3 : 5,
              tickfont: { size: fontSizes.tick },
              gridcolor: chartGridColor(),
              linecolor: chartGridColor(),
              showgrid: config.showGrid !== false,
            },
            angularaxis: {
              visible: angularAxisVisible,
              showgrid: config.showGrid !== false,
              tickmode: axisCategories ? "array" : "linear",
              ...(axisCategories
                ? {
                    tickvals: categories
                      ? categories.map((_, i) => i * (360 / categories.length))
                      : inferredCategories,
                    ticktext,
                  }
                : {}),
              tickangle: tickAngle,
              tickfont: { size: fontSizes.tick },
              direction: "clockwise",
              period: inferredCategories?.length ?? 360,
              ...(inferredCategories
                ? { type: "category", categoryorder: "array", categoryarray: inferredCategories }
                : {}),
              gridcolor: chartGridColor(),
              linecolor: chartGridColor(),
              showticklabels: showTickLabels,
            },
            gridshape: gridShape,
          },
        },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
    [
      angularAxisVisible,
      categories,
      axisCategories,
      inferredCategories,
      config,
      plotData,
      fontSizes.tick,
      gridShape,
      radialAxisVisible,
      rangeMode,
      showTickLabels,
      chrome,
      tickAngle,
      themeVersion,
      fontRevision,
    ],
  );

  const diameter = polarDiameter(
    normal.layout as unknown as Partial<Layout>,
    viewportWidth,
    height,
  );
  const extents = useMemo(
    () =>
      data.flatMap((series) => {
        if (series.visible === false || series.visible === "legendonly") return [];
        const values = series.r.filter(Number.isFinite);
        if (!values.length) return [];
        const padding =
          !series.mode || series.mode.includes("markers")
            ? Math.max(3, (series.marker?.size || 8) / 1.6)
            : 0;
        return [{ min: Math.min(...values), max: Math.max(...values), padding }];
      }),
    [data],
  );

  const range = useCallback(
    (size: number): [number, number] => {
      const min = rangeMode === "normal" ? Math.min(0, ...extents.map((series) => series.min)) : 0;
      const max = Math.max(
        min,
        ...extents.map(
          (series) => min + (series.max - min) / Math.max(0.5, 1 - series.padding / (size / 2)),
        ),
      );
      return [min, max > min ? max : min + 1];
    },
    [extents, rangeMode],
  );
  const headings = useMemo(
    () =>
      normal.layout.polar.angularaxis.ticktext?.map((text, index, ticks) => ({
        text,
        angle: (index * 360) / ticks.length,
      })) ?? [],
    [normal],
  );
  const radialRange = range(diameter);
  const needsCompact =
    height > 0 &&
    (diameter - AUTOSIZE_TOLERANCE < MIN_OUTER_PLOT_HEIGHT ||
      (headings.length > 0 &&
        angularAxisVisible &&
        showTickLabels &&
        tickAngle === 0 &&
        radarLabelsCollide({
          diameter,
          size: fontSizes.tick,
          labels: headings,
          range: radialRange,
          ticks: radialAxisVisible
            ? linearTicks(...radialRange, normal.layout.polar.radialaxis.nticks)
            : [],
          measure: measurePolarLabel,
        })));
  const compactHeight = needsCompact ? height : 0;
  const maxPlotHeight = needsCompact ? Math.max(diameter, MIN_OUTER_PLOT_HEIGHT) : 0;
  const compactRange = range(maxPlotHeight);
  const sparseTicks = needsCompact ? linearTicks(...compactRange, 2) : [];
  const radialTicks = (
    needsCompact && sparseTicks.length < 2 ? linearTicks(...compactRange, 3) : sparseTicks
  ).join(",");
  const figure = useMemo(() => {
    if (!compactHeight) return normal;
    const headings = axisCategories ?? [];
    const dense = headings.length >= 6;
    const headingFont = dense ? Math.min(fontSizes.tick, 9) : fontSizes.tick;
    const step = (2 * Math.PI) / Math.max(3, headings.length);
    const centeredWidth = Math.max(
      headingFont * 4,
      (maxPlotHeight + 2 * headingFont) * Math.sin(step) + 1,
    );
    // Centered headings extend toward their neighbours. Side headings extend outward.
    const ticktext = headings.map((label, index) =>
      wrapChartLabel(
        label,
        headingFont,
        dense && Math.abs(Math.sin(step * index)) < 0.1 ? Math.min(112, centeredWidth) : 112,
      ),
    );
    const outer = withOuterLabels({
      config,
      sizing: chrome,
      traces: plotData,
      labels: radarLabelMargins(ticktext, headingFont, true),
      compact: { height: compactHeight, maxPlotHeight },
    });
    const compactDiameter = polarDiameter(outer.layout, viewportWidth, compactHeight);
    const ticks = radialTicks.split(",").map(Number);
    const axisRange = range(compactDiameter);
    const compactAxis =
      gridShape === "circular" &&
      angularAxisVisible &&
      showTickLabels &&
      radialAxisVisible &&
      tickAngle === 0
        ? fitCompactRadarTicks({
            diameter: compactDiameter,
            headingSize: headingFont,
            tickSize: fontSizes.tick,
            labels: ticktext.map((text, index) => ({
              text,
              angle: (index * 360) / ticktext.length,
            })),
            range: axisRange,
            ticks,
            measure: measurePolarLabel,
          })
        : { angle: -90, ticks };
    const { polar } = normal.layout;
    return {
      data: outer.data,
      layout: {
        ...outer.layout,
        font: normal.layout.font,
        polar: {
          ...polar,
          radialaxis: {
            ...polar.radialaxis,
            nticks: 2,
            angle: compactAxis.angle,
            tickangle: compactAxis.angle,
            tickmode: "array",
            tickvals: compactAxis.ticks,
            ticktext: compactAxis.ticks.map((tick) => formatRadialTick(tick, axisRange)),
          },
          angularaxis: { ...polar.angularaxis, ticktext, tickfont: { size: headingFont } },
        },
      } as unknown as Partial<Layout>,
    };
  }, [
    axisCategories,
    config,
    fontSizes.tick,
    compactHeight,
    maxPlotHeight,
    normal,
    plotData,
    chrome,
    radialTicks,
    angularAxisVisible,
    gridShape,
    radialAxisVisible,
    range,
    showTickLabels,
    tickAngle,
    viewportWidth,
  ]);

  const plotConfig = useMemo(() => createPlotlyConfig(config, chrome), [config, chrome]);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        data={figure.data}
        layout={figure.layout as unknown as Partial<Layout>}
        config={plotConfig}
        loading={loading || sizing.height === undefined}
        error={error}
      />
    </div>
  );
}

// Multi-series radar chart
export interface MultiRadarProps extends BaseChartProps {
  series: Array<{
    values: number[];
    name: string;
    color?: string;
    fillColor?: string;
  }>;
  categories: string[];
  showFill?: boolean;
}

export function MultiRadar({ series, categories, showFill = true, ...props }: MultiRadarProps) {
  return (
    <RadarPlot
      data={series.map((s, i) => ({
        r: s.values,
        theta: categories,
        name: s.name,
        color: s.color || `hsl(${i * 60}, 70%, 50%)`,
        fill: showFill ? "toself" : "none",
        fillcolor: s.fillColor || s.color || `hsl(${i * 60}, 70%, 50%)`,
        mode: "lines+markers",
        opacity: showFill ? 0.6 : 1,
      }))}
      categories={categories}
      {...props}
    />
  );
}
