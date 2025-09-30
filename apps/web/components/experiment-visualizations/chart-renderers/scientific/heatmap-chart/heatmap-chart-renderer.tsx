"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { Heatmap } from "@repo/ui/components";

interface HeatmapConfig {
  xColumn?: string;
  xTitle?: string;
  yColumn?: string;
  yTitle?: string;
  zColumn?: string;
  zTitle?: string;
  colorscale?: string;
  reversescale?: boolean;
  showscale?: boolean;
  opacity?: number;
  title?: string;
  showValues?: boolean;
  textColor?: string;
  textSize?: number;
  aspectRatio?: number;
}

export interface HeatmapChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function HeatmapChartRenderer({
  visualization,
  data,
  height = 400,
}: HeatmapChartRendererProps) {
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
    // Ensure this is a heatmap chart
    if (!visualization.config || visualization.chartType !== "heatmap") {
      throw new Error("Invalid chart type for heatmap chart renderer");
    }

    // Extract configuration properties
    const config = visualization.config as HeatmapConfig;

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

    // Get unique x and y values
    const xValues = Array.from(new Set(data.map((row) => row[xColumnName])))
      .filter((val) => val != null)
      .map(String)
      .sort();

    const yValues = Array.from(new Set(data.map((row) => row[yColumnName])))
      .filter((val) => val != null)
      .map(String)
      .sort();

    // Create matrices
    const zMatrix: number[][] = [];
    const textMatrix: string[][] = [];

    for (let i = 0; i < yValues.length; i++) {
      zMatrix[i] = new Array<number>(xValues.length).fill(NaN);
      textMatrix[i] = new Array<string>(xValues.length).fill("");
    }

    // Fill matrices with data
    data.forEach((row) => {
      const xValue = String(row[xColumnName]);
      const yValue = String(row[yColumnName]);
      const zValue = row[zColumnName];

      const xIndex = xValues.indexOf(xValue);
      const yIndex = yValues.indexOf(yValue);

      if (xIndex !== -1 && yIndex !== -1 && zValue != null) {
        const numericZValue = Number(zValue);
        if (!isNaN(numericZValue)) {
          zMatrix[yIndex][xIndex] = numericZValue;
          textMatrix[yIndex][xIndex] =
            typeof zValue === "string" || typeof zValue === "number" ? String(zValue) : "";
        }
      }
    });

    // Prepare heatmap data
    const heatmapData = [
      {
        x: xValues,
        y: yValues,
        z: zMatrix,
        text: config.showValues ? textMatrix : undefined,
        texttemplate: config.showValues ? "%{text}" : undefined,
        textfont: config.showValues
          ? {
              color: config.textColor ?? "white",
              size: config.textSize ?? 12,
            }
          : undefined,
        type: "heatmap",
        colorscale: config.colorscale ?? "Viridis",
        reversescale: config.reversescale ?? false,
        showscale: config.showscale ?? true,
        opacity: config.opacity ?? 1.0,
        hovertemplate: "%{x}<br>%{y}<br>%{z}<extra></extra>",
        colorbar: {
          title: config.zTitle ?? zDataSources[0].alias ?? zDataSources[0].columnName,
          titleside: "right" as const,
        },
      },
    ];

    // Chart configuration
    const chartConfig = {
      title: config.title ?? visualization.name,
      useWebGL: false,
      responsive: true,
      layout: {
        height,
        xaxis: {
          title: config.xTitle ?? xDataSources[0].alias ?? xDataSources[0].columnName,
          type: "category" as const,
        },
        yaxis: {
          title: config.yTitle ?? yDataSources[0].alias ?? yDataSources[0].columnName,
          type: "category" as const,
        },
        showlegend: false,
      },
    };

    return (
      <div className="h-full w-full">
        <Heatmap data={heatmapData} config={chartConfig} className="h-full w-full" />
      </div>
    );
  } catch (error) {
    console.error("Error rendering heatmap chart:", error);
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 font-medium">Chart Rendering Error</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : "Unable to render heatmap chart"}
          </div>
        </div>
      </div>
    );
  }
}
