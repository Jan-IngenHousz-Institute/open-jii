"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import type { PlotlyChartConfig, ScatterSeriesData } from "@repo/ui/components";
import { ScatterChart } from "@repo/ui/components";

import type { ScatterChartConfig } from "../../../types/chart-config-types";

export interface ScatterChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function ScatterChartRenderer({
  visualization,
  data,
  height = 400,
  isPreview: _isPreview = false,
}: ScatterChartRendererProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="mb-2 text-lg font-medium">No Data Available</div>
          <div className="text-sm">Please ensure your experiment has data to visualize</div>
        </div>
      </div>
    );
  }

  try {
    // Ensure this is a scatter chart and we have data sources
    if (!visualization.config || visualization.chartType !== "scatter") {
      throw new Error("Invalid chart type for scatter chart renderer");
    }

    // Get role-based data sources
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");
    const colorDataSources = visualization.dataConfig.dataSources.filter(
      (ds) => ds.role === "color",
    );

    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error("X-axis column not configured");
    }

    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error("Y-axis column not configured");
    }

    const xColumn = xDataSources[0].columnName;

    // Prepare scatter plot data using role-based approach
    // Use the flat config structure that matches the form defaults
    const scatterConfig = visualization.config as ScatterChartConfig;

    const scatterData = yDataSources.map((yDataSource, index) => {
      const xValues = data.map((row) => {
        const value = row[xColumn];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });
      const yValues = data.map((row) => {
        const value = row[yDataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      // Handle color mapping if color role is configured
      let colorValues: string[] | undefined;
      if (colorDataSources.length > 0 && colorDataSources[0]?.columnName) {
        colorValues = data.map((row) => {
          const value = row[colorDataSources[0].columnName];
          return String(value);
        });
      }

      const colorPalette = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];
      const baseColor = colorPalette[index % colorPalette.length];

      return {
        x: xValues,
        y: yValues,
        name: yDataSource.alias ?? yDataSource.columnName,
        mode: (scatterConfig.mode ?? "markers") as "markers" | "lines" | "lines+markers",
        marker: {
          size: scatterConfig.markerSize ?? 6,
          symbol: scatterConfig.markerShape ?? "circle",
          color: colorValues ?? baseColor,
          colorscale: colorValues ? scatterConfig.colorScale : undefined,
          showscale: colorValues ? scatterConfig.showColorBar : undefined,
        },
        type: "scatter" as const,
      };
    });

    // Create the Plotly config with axis titles and colorbar title
    const plotlyConfig: PlotlyChartConfig = {
      ...(visualization.config as PlotlyChartConfig),
      xAxisTitle: scatterConfig.xTitle,
      yAxisTitle: scatterConfig.yTitle,
      title: scatterConfig.title,
    };

    // Add colorbar title if color mapping is enabled
    if (colorDataSources.length > 0) {
      scatterData.forEach((series: ScatterSeriesData) => {
        if (series.marker?.showscale) {
          series.marker.colorbar = {
            title: scatterConfig.zTitle ?? colorDataSources[0]?.columnName,
            thickness: 15,
            len: 0.9,
          };
        }
      });
    }

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <ScatterChart data={scatterData} config={plotlyConfig} />
      </div>
    );
  } catch (error) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium">Configuration Error</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : "Invalid chart configuration"}
          </div>
        </div>
      </div>
    );
  }
}
