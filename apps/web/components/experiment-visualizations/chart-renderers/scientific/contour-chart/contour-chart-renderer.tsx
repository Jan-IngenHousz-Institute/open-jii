"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { ContourPlot } from "@repo/ui/components";

interface ContourConfig {
  config?: {
    xAxis?: { title?: string };
    yAxis?: { title?: string };
    zAxis?: { title?: string };
    display?: { title?: string; showLegend?: boolean; legendPosition?: string };
    ncontours?: number;
    colorscale?: string;
    showlabels?: boolean;
  };
}

export interface ContourChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function ContourChartRenderer({
  visualization,
  data,
  height = 400,
}: ContourChartRendererProps) {
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
    // Ensure this is a contour chart and we have data sources
    if (!visualization.config || visualization.chartType !== "contour") {
      throw new Error("Invalid chart type for contour chart renderer");
    }

    // Extract configuration properties
    const config = visualization.config as ContourConfig;

    // Get role-based data sources
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");
    const zDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "z");

    // Validate required columns
    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error("X-axis column not configured");
    }
    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error("Y-axis column not configured");
    }
    if (!zDataSources.length || !zDataSources[0]?.columnName) {
      throw new Error("Z-axis (values) column not configured");
    }

    const xColumnName = xDataSources[0].columnName;
    const yColumnName = yDataSources[0].columnName;
    const zColumnName = zDataSources[0].columnName;

    // Get unique x and y values directly from data - no conversions
    const xValues = Array.from(new Set(data.map((row) => row[xColumnName])))
      .filter((val): val is string | number | Date => val != null)
      .sort();

    const yValues = Array.from(new Set(data.map((row) => row[yColumnName])))
      .filter((val): val is string | number | Date => val != null)
      .sort();

    // Create z matrix
    const zMatrix: number[][] = [];

    // Initialize matrix with NaN values
    for (let i = 0; i < yValues.length; i++) {
      zMatrix[i] = new Array<number>(xValues.length).fill(NaN);
    }

    // Fill matrix with data - simple approach
    data.forEach((row) => {
      const xValue = row[xColumnName];
      const yValue = row[yColumnName];
      const zValue = row[zColumnName];

      if (
        xValue != null &&
        yValue != null &&
        zValue != null &&
        (typeof xValue === "string" || typeof xValue === "number" || xValue instanceof Date) &&
        (typeof yValue === "string" || typeof yValue === "number" || yValue instanceof Date)
      ) {
        const xIndex = xValues.indexOf(xValue);
        const yIndex = yValues.indexOf(yValue);

        if (xIndex !== -1 && yIndex !== -1) {
          const numericZValue = Number(zValue);
          if (!isNaN(numericZValue)) {
            zMatrix[yIndex][xIndex] = numericZValue;
          }
        }
      }
    });

    // Prepare contour plot data
    const contourData = [
      {
        x: xValues,
        y: yValues,
        z: zMatrix,
        name: visualization.name,
        colorscale: "Viridis" as const,
        showscale: true,
        colorbar: {
          title: zDataSources[0]?.alias ?? zColumnName,
          titleside: "right" as const,
        },
        ncontours: 15,
        autocontour: true,
        contours: {
          coloring: "heatmap" as const,
          showlines: true,
          showlabels: false,
          labelfont: {
            size: 12,
            color: "black",
          },
        },
        connectgaps: true,
        smoothing: 1,
        hovertemplate: "%{x}<br>%{y}<br>%{z}<extra></extra>",
      },
    ];

    // Chart configuration
    const chartConfig = {
      title: visualization.name,
      xAxisTitle: xDataSources[0]?.alias ?? xColumnName,
      yAxisTitle: yDataSources[0]?.alias ?? yColumnName,
      useWebGL: false,
      responsive: true,
      showlegend: true,
      height,
    };

    return (
      <div className="h-full w-full">
        <ContourPlot data={contourData} config={chartConfig} className="h-full w-full" />
      </div>
    );
  } catch (error) {
    console.error("Error rendering contour chart:", error);
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 font-medium">Chart Rendering Error</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : "Unable to render contour chart"}
          </div>
        </div>
      </div>
    );
  }
}
