"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries } from "../../common";
import { PlotlyChart, createPlotlyConfig, getRenderer, getPlotType } from "../../common";

export interface WindRoseSeriesData extends BaseSeries {
  r: number[]; // Wind speed values
  theta: number[]; // Wind direction in degrees (0-360)
  mode?: "markers" | "lines" | "lines+markers";
  marker?: {
    color?: string | string[];
    size?: number | number[];
    symbol?: string;
    colorscale?: string;
    showscale?: boolean;
    line?: {
      color?: string;
      width?: number;
    };
  };
  line?: {
    color?: string;
    width?: number;
    dash?: string;
  };
  fill?: "none" | "toself" | "tonext";
  fillcolor?: string;
}

export interface WindRoseProps extends BaseChartProps {
  data: WindRoseSeriesData[];
  showDirectionLabels?: boolean;
  directionLabels?: string[];
  radialAxisTitle?: string;
  angularAxisTitle?: string;
  sector?: {
    start?: number;
    end?: number;
  };
}

export function WindRose({
  data,
  config = {},
  className,
  loading,
  error,
  showDirectionLabels = true,
  directionLabels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  radialAxisTitle = "Wind Speed",
  angularAxisTitle = "Direction",
  sector,
}: WindRoseProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatterpolar", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        r: series.r,
        theta: series.theta,
        name: series.name,
        type: plotType,
        mode: series.mode || "markers",

        marker: series.marker
          ? {
              color: series.marker.color || series.color,
              size: series.marker.size || 8,
              symbol: series.marker.symbol || "circle",
              colorscale: series.marker.colorscale,
              showscale: series.marker.showscale || false,
              line: series.marker.line
                ? {
                    color: series.marker.line.color,
                    width: series.marker.line.width || 0,
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
            }
          : undefined,

        fill: series.fill || "none",
        fillcolor: series.fillcolor || series.color,

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  // Create polar layout for wind rose with responsive sizing
  const layout = {
    title: config.title ? { text: config.title } : undefined,
    // Remove fixed width/height to allow container-based sizing
    paper_bgcolor: config.backgroundColor || "white",
    autosize: true, // Enable responsive sizing

    polar: {
      radialaxis: {
        title: radialAxisTitle,
        angle: 90,
        tickangle: 0,
      },
      angularaxis: {
        title: angularAxisTitle,
        tickmode: showDirectionLabels ? "array" : "linear",
        ...(showDirectionLabels
          ? {
              tickvals: [0, 45, 90, 135, 180, 225, 270, 315],
              ticktext: directionLabels,
            }
          : {}),
        direction: "clockwise",
        period: 360,
        ...(sector
          ? {
              range: [sector.start || 0, sector.end || 360],
            }
          : {}),
      },
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
