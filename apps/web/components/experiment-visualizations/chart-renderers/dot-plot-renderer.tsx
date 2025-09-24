"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { ScatterChart } from "@repo/ui/components";

export interface DotPlotRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function DotPlotRenderer({
  visualization,
  data,
  height = 400,
  isPreview: _isPreview = false,
}: DotPlotRendererProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-muted/20 flex h-full items-center justify-center rounded-lg border-2 border-dashed">
        <div className="text-center">
          <div className="text-muted-foreground mb-2 font-medium">No Data Available</div>
          <div className="text-muted-foreground text-sm">No data found for this visualization</div>
        </div>
      </div>
    );
  }

  try {
    // Ensure this is a dot-plot chart and get configuration with proper typing
    if (visualization.config.chartType !== "dot-plot") {
      throw new Error("Invalid chart type for dot plot renderer");
    }

    const config = visualization.config.config;

    if (!config.xAxis.dataSource.columnName) {
      throw new Error("X-axis column not configured");
    }

    if (!config.yAxes.length || !config.yAxes[0]?.dataSource.columnName) {
      throw new Error("Y-axis column not configured");
    }

    // Prepare dot plot data (similar to scatter plot but optimized for dot plots)
    const dotPlotData = config.yAxes.map((yAxis, index) => {
      const xColumnName = config.xAxis.dataSource.columnName;
      const yColumnName = yAxis.dataSource.columnName;

      const xData = data.map((row) => {
        const value = row[xColumnName];
        if (typeof value === "number") return value;
        if (typeof value === "string") {
          const num = Number(value);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      });

      const yData = data.map((row) => {
        const value = row[yColumnName];
        if (typeof value === "number") return value;
        if (typeof value === "string") {
          const num = Number(value);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      });

      return {
        x: xData,
        y: yData,
        name: yAxis.title ?? yAxis.dataSource.alias ?? yColumnName,
        color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        // Dot plots use markers only mode
        mode: "markers" as const,
        marker: {
          size: config.markerSize || 8,
          symbol: config.markerShape,
          color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        },
      };
    });

    const chartConfig = {
      title: config.display?.title ?? visualization.name,
      xAxisTitle: config.xAxis.title ?? config.xAxis.dataSource.columnName,
      yAxisTitle: config.yAxes[0]?.title ?? "Values",
      useWebGL: false, // Dot plots typically don't need WebGL
      showLegend: config.display?.showLegend ?? true,
      height,
    };

    return <ScatterChart data={dotPlotData} config={chartConfig} />;
  } catch (error) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium">Dot Plot Configuration Error</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : "Invalid dot plot configuration"}
          </div>
        </div>
      </div>
    );
  }
}
