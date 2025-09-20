"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries } from "../../common";
import { PlotlyChart, createPlotlyConfig, getRenderer, getPlotType } from "../../common";

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
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatterpolar", renderer);

  const plotData: PlotData[] = data.map(
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
  );

  // Create polar layout for radar chart with responsive sizing
  const layout = {
    title: config.title ? { text: config.title } : undefined,
    // Remove fixed width/height to allow container-based sizing
    paper_bgcolor: config.backgroundColor || "white",
    autosize: true, // Enable responsive sizing

    polar: {
      radialaxis: {
        visible: radialAxisVisible,
        range: rangeMode === "tozero" ? [0, undefined] : undefined,
        rangemode: rangeMode,
        gridcolor: "#E6E6E6",
        linecolor: "#444",
      },
      angularaxis: {
        visible: angularAxisVisible,
        tickmode: categories ? "array" : "linear",
        ...(categories
          ? {
              tickvals: categories.map((_, i) => i * (360 / categories.length)),
              ticktext: categories,
            }
          : {}),
        tickangle: tickAngle,
        direction: "clockwise",
        period: 360,
        gridcolor: "#E6E6E6",
        linecolor: "#444",
        showticklabels: showTickLabels,
      },
      gridshape: gridShape,
    },

    showlegend: config.showLegend !== false,
  } as any;

  const plotConfig = createPlotlyConfig(config);

  return (
    <div className={className}>
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
