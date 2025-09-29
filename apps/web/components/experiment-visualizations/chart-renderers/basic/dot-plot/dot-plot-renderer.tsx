"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { ScatterChart } from "@repo/ui/components";

interface DotPlotConfig {
  chartTitle?: string;
  yAxisTitle?: string;
  color?: string;
  markerSize?: number;
  markerShape?: string;
  opacity?: number;
}

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
    // Ensure this is a dot plot and we have data sources
    if (!visualization.config || visualization.chartType !== "dot-plot") {
      throw new Error("Invalid chart type for dot plot renderer");
    }

    // Extract configuration properties
    const config = visualization.config as DotPlotConfig;

    // Get role-based data sources
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");

    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error("X-axis column not configured");
    }

    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error("Y-axis column not configured");
    }

    const xColumn = xDataSources[0].columnName;

    // Prepare dot plot data using role-based approach
    const dotPlotData = yDataSources.map((yDataSource, index) => {
      const xColumnName = xColumn;
      const yColumnName = yDataSource.columnName;

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

      const colorPalette = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];
      const seriesColor = colorPalette[index % colorPalette.length];

      return {
        x: xData,
        y: yData,
        name: yDataSource.alias ?? yColumnName,
        color: seriesColor,
        // Dot plots use markers only mode
        mode: "markers" as const,
        marker: {
          size: config.markerSize ?? 8,
          symbol:
            (config.markerShape as
              | "circle"
              | "square"
              | "diamond"
              | "triangle-up"
              | "triangle-down"
              | undefined) ?? "circle",
          color: config.color ?? seriesColor,
          opacity: config.opacity ?? 1.0,
        },
      };
    });

    const chartConfig = {
      title: config.chartTitle ?? visualization.name,
      xAxisTitle: xDataSources[0]?.alias ?? xColumn,
      yAxisTitle:
        config.yAxisTitle ??
        (yDataSources.length === 1
          ? (yDataSources[0]?.alias ?? yDataSources[0]?.columnName)
          : "Values"),
      useWebGL: false, // Dot plots typically don't need WebGL
      showLegend: true,
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
