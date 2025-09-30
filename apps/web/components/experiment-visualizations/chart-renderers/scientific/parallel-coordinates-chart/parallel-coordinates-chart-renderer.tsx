"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { ParallelCoordinates } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";

export interface ParallelCoordinatesChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function ParallelCoordinatesChartRenderer({
  visualization,
  experimentId,
  data: providedData,
  height = 400,
  isPreview: _isPreview = false,
}: ParallelCoordinatesChartRendererProps) {
  // Fetch data if not provided
  const {
    data: fetchedData,
    isLoading,
    error,
  } = useExperimentVisualizationData(
    experimentId,
    {
      tableName: visualization.dataConfig.tableName,
      columns: visualization.dataConfig.dataSources.map((ds) => ds.columnName),
    },
    !providedData,
  );

  const chartData = providedData ?? fetchedData?.rows ?? [];

  if (isLoading && !providedData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">Loading visualization...</div>
      </div>
    );
  }

  if (error && !providedData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-destructive">Error loading visualization</div>
      </div>
    );
  }

  if (!Array.isArray(chartData) || chartData.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">No data available for visualization</div>
      </div>
    );
  }

  try {
    // Ensure this is a parallel coordinates chart
    if (!visualization.config || visualization.chartType !== "parallel-coordinates") {
      throw new Error("Invalid chart type for parallel coordinates renderer");
    }

    // Get all data sources (parallel coordinates uses all as dimensions)
    const dataSources = visualization.dataConfig.dataSources;

    // Validate required dimensions
    if (dataSources.length < 2) {
      throw new Error("Parallel coordinates chart requires at least 2 dimensions");
    }

    // Extract dimension data from the dataset
    const dimensions = dataSources
      .filter((dataSource) => dataSource.columnName)
      .map((dataSource) => {
        const columnName = dataSource.columnName;
        const values = chartData.map((row) => {
          const value = row[columnName];
          return typeof value === "number" ? value : parseFloat(String(value)) || 0;
        });

        return {
          label: dataSource.alias ?? columnName,
          values,
          range: undefined,
          tickvals: undefined,
          ticktext: undefined,
          constraintrange: undefined,
          multiselect: true,
          visible: true,
        };
      });

    if (dimensions.length === 0) {
      throw new Error("No valid dimensions found for parallel coordinates chart");
    }

    // Prepare data for ParallelCoordinates component
    const parallelData = [
      {
        name: visualization.name,
        dimensions,
        line: {
          color: "blue",
          width: 1,
        },
        labelangle: 0,
        labelside: "top" as const,
        rangefont: {
          size: 12,
          color: "#444",
        },
        tickfont: {
          size: 10,
          color: "#444",
        },
      },
    ];

    const chartConfig = {
      title: visualization.name,
      showLegend: false,
      interactive: true,
      height,
      useWebGL: false, // Generally not needed for parallel coordinates
      responsive: true,
    };

    return (
      <div className="w-full" style={{ height: `${height}px` }}>
        <ParallelCoordinates data={parallelData} config={chartConfig} className="h-full w-full" />
      </div>
    );
  } catch (error) {
    console.error("Error rendering parallel coordinates chart:", error);
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-destructive">
          Error rendering chart: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }
}
