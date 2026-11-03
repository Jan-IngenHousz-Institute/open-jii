"use client";

import type { PlotData } from "plotly.js";
import React, { useMemo } from "react";

import { cn } from "../../lib/utils";
import { chartTextWidth, withOuterLabels, wrapChartLabel } from "./outer-labels";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries } from "./types";
import { useChartThemeRefresh } from "./use-chart-theme-refresh";
import { useChartSizing } from "./use-is-compact";
import {
  createPlotlyConfig,
  getRenderer,
  getPlotType,
  responsiveChrome,
  tierAxisFontSizes,
  chartGridColor,
} from "./utils";

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
  config = {},
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
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>({ trackWidth: true });
  const themeVersion = useChartThemeRefresh();
  const fontSizes = tierAxisFontSizes(sizing);
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

  const displayCategories = useMemo(
    () =>
      axisCategories?.map((label) =>
        wrapChartLabel(label, fontSizes.tick, sizing.compact ? 72 : 96),
      ),
    [axisCategories, fontSizes.tick, sizing.compact],
  );
  const outerLabels = useMemo(() => {
    const side = Math.max(
      32,
      ...(displayCategories ?? []).map((label) => chartTextWidth(label, fontSizes.tick) + 12),
    );
    const height = Math.max(
      32,
      ...(displayCategories ?? []).map(
        (label) => label.split("<br>").length * fontSizes.tick * 1.3 + 12,
      ),
    );
    return { left: side, right: side, top: height, bottom: height };
  }, [displayCategories, fontSizes.tick]);

  // Tier-aware chrome + the polar config createBaseLayout cannot provide.
  const figure = useMemo(
    () => {
      const outer = withOuterLabels(
        responsiveChrome(config, sizing),
        config,
        outerLabels,
        plotData,
        undefined,
        sizing.width,
      );
      return {
        data: outer.data,
        layout: {
          ...outer.layout,

          polar: {
            radialaxis: {
              visible: radialAxisVisible,
              range: rangeMode === "tozero" ? [0, undefined] : undefined,
              rangemode: rangeMode,
              nticks: sizing.compact ? 3 : 5,
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
                    ticktext: displayCategories,
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
        } as any,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion is a cache key.
    [
      angularAxisVisible,
      categories,
      axisCategories,
      inferredCategories,
      displayCategories,
      outerLabels,
      config,
      plotData,
      fontSizes.tick,
      gridShape,
      radialAxisVisible,
      rangeMode,
      showTickLabels,
      sizing,
      tickAngle,
      themeVersion,
    ],
  );

  const plotConfig = useMemo(() => createPlotlyConfig(config, sizing), [config, sizing]);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        data={figure.data}
        layout={figure.layout}
        config={plotConfig}
        loading={loading}
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
