"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { ContourPlot } from "@repo/ui/components";

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
    // Ensure this is a contour chart
    if (visualization.config.chartType !== "contour") {
      throw new Error("Invalid chart type for contour chart renderer");
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
        colorscale: config.colorscale,
        showscale: config.showScale !== false,
        colorbar:
          config.showScale !== false
            ? {
                title:
                  config.colorbarTitle ?? config.zAxis.title ?? config.zAxis.dataSource.columnName,
                titleside: "right" as const,
              }
            : undefined,
        ncontours: config.ncontours || 15,
        autocontour: config.autocontour !== false,
        contours: {
          coloring: config.contours.coloring,
          showlines: config.contours.showlines !== false,
          showlabels: config.contours.showlabels === true,
          start: config.contours.start,
          end: config.contours.end,
          size: config.contours.size,
          labelfont: config.contours.labelfont ?? {
            size: 12,
            color: "black",
          },
        },
        connectgaps: config.connectgaps !== false,
        smoothing: config.smoothing || 1,
        hovertemplate: config.hoverTemplate ?? "%{x}<br>%{y}<br>%{z}<extra></extra>",
      },
    ];

    // Chart configuration
    const chartConfig = {
      title: config.display?.title ?? visualization.name,
      xAxisTitle: config.xAxis.title ?? config.xAxis.dataSource.columnName,
      yAxisTitle: config.yAxis.title ?? config.yAxis.dataSource.columnName,
      useWebGL: false,
      responsive: true,
      showlegend: config.display?.showLegend !== false,
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
