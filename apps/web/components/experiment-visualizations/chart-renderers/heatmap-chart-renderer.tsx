"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { Heatmap } from "@repo/ui/components";

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
    if (visualization.config.chartType !== "heatmap") {
      throw new Error("Invalid chart type for heatmap chart renderer");
    }

    const config = visualization.config.config;

    // Validate required columns
    if (!config.xAxis.dataSource.columnName) {
      throw new Error("X-axis column not configured");
    }
    if (!config.yAxis.dataSource.columnName) {
      throw new Error("Y-axis column not configured");
    }
    if (!config.zAxis.dataSource.columnName) {
      throw new Error("Z-axis (values) column not configured");
    }

    const xColumnName = config.xAxis.dataSource.columnName;
    const yColumnName = config.yAxis.dataSource.columnName;
    const zColumnName = config.zAxis.dataSource.columnName;

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
        type: "heatmap",
        colorscale: config.colorscale,
        showscale: config.showScale !== false,
        text: config.showText ? textMatrix : undefined,
        texttemplate: config.showText ? config.textTemplate : undefined,
        textfont: config.textFont
          ? {
              size: config.textFont.size,
              color: config.textFont.color,
            }
          : undefined,
        connectgaps: config.connectGaps,
        hovertemplate: config.hoverTemplate ?? "%{x}<br>%{y}<br>%{z}<extra></extra>",
        colorbar:
          config.showScale !== false
            ? {
                title: config.zAxis.title ?? config.zAxis.dataSource.columnName,
                titleside: "right" as const,
              }
            : undefined,
      },
    ];

    // Chart configuration
    const chartConfig = {
      title: config.display?.title ?? visualization.name,
      useWebGL: false,
      responsive: true,
      layout: {
        height,
        xaxis: {
          title: config.xAxis.title ?? config.xAxis.dataSource.columnName,
          type: config.xAxis.type === "category" ? "category" : "linear",
        },
        yaxis: {
          title: config.yAxis.title ?? config.yAxis.dataSource.columnName,
          type: config.yAxis.type === "category" ? "category" : "linear",
        },
        showlegend: config.display?.showLegend !== false,
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
