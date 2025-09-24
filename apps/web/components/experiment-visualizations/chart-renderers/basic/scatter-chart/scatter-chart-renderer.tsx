"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { ScatterChart } from "@repo/ui/components";

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
    // Type-safe config access
    if (visualization.config.chartType !== "scatter") {
      throw new Error("Invalid chart type for scatter renderer");
    }

    const config = visualization.config.config;

    if (!config.xAxis.dataSource.columnName) {
      throw new Error("X-axis column not configured");
    }

    if (!config.yAxes.length || !config.yAxes[0]?.dataSource.columnName) {
      throw new Error("Y-axis column not configured");
    }

    // Prepare scatter plot data
    const scatterData = config.yAxes.map((yAxis) => {
      const xValues = data.map((row) => {
        const value = row[config.xAxis.dataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });
      const yValues = data.map((row) => {
        const value = row[yAxis.dataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      // Prepare marker configuration
      let markerConfig: {
        size: number;
        symbol: string;
        color?: string | number[];
        colorscale?: string;
        showscale?: boolean;
        colorbar?: {
          title?: string;
          titleside?: "right" | "top" | "bottom";
          thickness?: number;
          len?: number;
        };
      } = {
        size: config.markerSize,
        symbol: config.markerShape,
      };

      if (config.colorAxis?.dataSource.columnName) {
        // Extract color dimension values as numbers
        const colorValues = data.map((row) => {
          const value = row[config.colorAxis?.dataSource.columnName ?? ""];

          return typeof value === "number"
            ? value
            : typeof value === "string" && !isNaN(Number(value))
              ? Number(value)
              : 0; // Default to 0 for non-numeric values
        });

        console.log(config.colorScale);

        markerConfig = {
          ...markerConfig,
          color: colorValues,
          colorscale: config.colorScale,
          showscale: config.showColorBar,
          colorbar: config.showColorBar
            ? {
                title: config.colorAxis.title ?? config.colorAxis.dataSource.columnName,
                titleside: "right" as const,
              }
            : undefined,
        };
      } else {
        // Use solid color when no color dimension is configured
        markerConfig.color = yAxis.color;
      }

      return {
        x: xValues,
        y: yValues,
        name: yAxis.dataSource.alias ?? yAxis.dataSource.columnName,
        mode: config.mode,
        marker: markerConfig,
        type: "scatter" as const,
      };
    });

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <ScatterChart
          data={scatterData}
          config={{
            title: config.display?.title ?? visualization.name,
            xAxisTitle: config.xAxis.title ?? config.xAxis.dataSource.columnName,
            yAxisTitle:
              config.yAxes.length === 1
                ? (config.yAxes[0].title ?? config.yAxes[0].dataSource.columnName)
                : "Values",
            showLegend: config.display?.showLegend ?? true,
            responsive: true,
          }}
        />
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
