"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { AreaChart } from "@repo/ui/components";

export interface AreaChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function AreaChartRenderer({
  visualization,
  data,
  height = 400,
  isPreview: _isPreview = false,
}: AreaChartRendererProps) {
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
    // Ensure this is an area chart and get configuration with proper typing
    if (visualization.config.chartType !== "area") {
      throw new Error("Invalid chart type for area chart renderer");
    }

    const config = visualization.config.config;

    if (!config.xAxis.dataSource.columnName) {
      throw new Error("X-axis column not configured");
    }

    if (!config.yAxes.length || !config.yAxes[0]?.dataSource.columnName) {
      throw new Error("Y-axis column not configured");
    }

    // Prepare area chart data
    const areaData = config.yAxes.map((yAxis, index) => {
      const xValues = data.map((row) => {
        const value = row[config.xAxis.dataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });
      const yValues = data.map((row) => {
        const value = row[yAxis.dataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      // Determine fill mode based on configuration
      let fill: "tozeroy" | "tonexty" | "toself" | undefined;
      let fillcolor: string | undefined;

      if (config.fillMode === "tozeroy") {
        fill = "tozeroy";
      } else if (config.fillMode === "tonexty") {
        fill = "tonexty";
      } else if (config.fillMode === "toself") {
        fill = "toself";
      }

      if (fill && yAxis.color) {
        // Convert hex to rgba with opacity
        const opacity = config.fillOpacity || 0.6;
        if (yAxis.color.startsWith("#")) {
          const r = parseInt(yAxis.color.slice(1, 3), 16);
          const g = parseInt(yAxis.color.slice(3, 5), 16);
          const b = parseInt(yAxis.color.slice(5, 7), 16);
          fillcolor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } else if (yAxis.color.startsWith("hsl")) {
          // For HSL colors, we'll use the color with opacity
          fillcolor = yAxis.color.replace("hsl", "hsla").replace(")", `, ${opacity})`);
        } else {
          fillcolor = yAxis.color;
        }
      }

      const series = {
        x: xValues,
        y: yValues,
        name: yAxis.dataSource.alias ?? yAxis.dataSource.columnName,
        color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        mode: "lines" as const,
        type: "scatter" as const,
        line: {
          shape:
            config.smoothing && config.smoothing > 0 ? ("spline" as const) : ("linear" as const),
          smoothing: config.smoothing || 0,
        },
        ...(fill && { fill }),
        ...(fillcolor && { fillcolor }),
        ...(config.stackGroup && { stackgroup: config.stackGroup }),
      };

      return series;
    });

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <AreaChart
          data={areaData}
          config={{
            title: config.display?.title ?? visualization.name,
            xAxisTitle: config.xAxis.title ?? config.xAxis.dataSource.columnName,
            yAxisTitle:
              config.yAxes.length === 1
                ? (config.yAxes[0].title ?? config.yAxes[0].dataSource.columnName)
                : "Values",
            showLegend: config.display?.showLegend ?? true,
            showGrid: config.gridLines !== "none",
            useWebGL: false, // Area charts typically don't need WebGL
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
