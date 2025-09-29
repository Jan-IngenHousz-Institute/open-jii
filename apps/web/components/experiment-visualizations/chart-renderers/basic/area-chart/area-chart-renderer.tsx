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
    // Ensure this is an area chart and we have data sources
    if (!visualization.config || visualization.chartType !== "area") {
      throw new Error("Invalid chart type for area chart renderer");
    }

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

    // Extract config properties from the configurator
    interface AreaConfigType {
      fillMode?: string;
      fillOpacity?: number;
      smoothing?: number;
      lineWidth?: number;
      color?: string;
    }

    const config = visualization.config as AreaConfigType;

    // Prepare area chart data using role-based approach
    const areaData = yDataSources.map((yDataSource, index) => {
      const xValues = data.map((row) => {
        const value = row[xColumn];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });
      const yValues = data.map((row) => {
        const value = row[yDataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      // Use configurator settings or defaults
      const fillMode = (config.fillMode ?? "tozeroy") as
        | "none"
        | "tozeroy"
        | "tozerox"
        | "tonexty"
        | "tonextx"
        | "toself"
        | "tonext";
      const fillOpacity = config.fillOpacity ?? 0.6;

      // Use a predefined color palette instead of HSL
      const colorPalette = [
        "#3b82f6",
        "#ef4444",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#06b6d4",
        "#f97316",
        "#84cc16",
        "#ec4899",
        "#6366f1",
      ];
      const dataSourceColor = config.color ?? colorPalette[index % colorPalette.length];

      // Create fill color with opacity
      const fillcolor = `${dataSourceColor}${Math.round(fillOpacity * 255)
        .toString(16)
        .padStart(2, "0")}`;

      const series = {
        x: xValues,
        y: yValues,
        name: yDataSource.alias ?? yDataSource.columnName,
        color: dataSourceColor,
        mode: "lines" as const,
        type: "scatter" as const,
        line: {
          shape: "linear" as const,
          smoothing: config.smoothing ?? 0,
          width: config.lineWidth ?? 0,
        },
        fill: fillMode,
        fillcolor,
      };

      return series;
    });

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <AreaChart
          data={areaData}
          config={{
            title: visualization.name,
            xAxisTitle: xDataSources[0]?.alias ?? xColumn,
            yAxisTitle:
              yDataSources.length === 1
                ? (yDataSources[0]?.alias ?? yDataSources[0]?.columnName)
                : "Values",
            showLegend: true,
            showGrid: true,
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
