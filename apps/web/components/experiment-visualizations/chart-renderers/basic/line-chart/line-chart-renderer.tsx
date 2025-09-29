import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { LineChart } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import type { LineChartConfig } from "../../../types/chart-config-types";

interface LineChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height: number;
  isPreview: boolean;
}

export function LineChartRenderer({
  visualization,
  experimentId,
  data: providedData,
  height: _height,
  isPreview,
}: LineChartRendererProps) {
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
    !providedData, // Only fetch if data not provided
  );

  // Use provided data or fetched data - simplified for now
  const chartData = providedData ?? fetchedData?.rows ?? [];

  if (isLoading && !providedData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading chart data...</div>
      </div>
    );
  }

  if (error && !providedData) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 font-medium">Failed to load data</div>
          <div className="text-sm">Unable to fetch experiment data for this visualization</div>
        </div>
      </div>
    );
  }

  if (!Array.isArray(chartData) || chartData.length === 0) {
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
    // Ensure this is a line chart and we have data sources
    if (!visualization.config || visualization.chartType !== "line") {
      throw new Error("Invalid chart type for line chart renderer");
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
    interface LineConfigType {
      mode?: string;
      connectGaps?: boolean;
      smoothing?: number;
      lineWidth?: number;
    }

    const config = visualization.config as LineConfigType;

    // Prepare chart data arrays using role-based approach
    const chartSeries = yDataSources.map((yDataSource, index) => {
      const xColumnName = xColumn;
      const yColumnName = yDataSource.columnName;

      // Extract data for this series with type conversion
      const xData = chartData.map((row) => {
        const value = row[xColumnName];
        // Convert to number or string or date
        if (typeof value === "number" || typeof value === "string") {
          return value;
        }
        return 0; // fallback
      });

      const yData = chartData.map((row) => {
        const value = row[yColumnName];
        // Convert to number
        if (typeof value === "number") {
          return value;
        }
        if (typeof value === "string") {
          const num = Number(value);
          return isNaN(num) ? 0 : num;
        }
        return 0; // fallback
      });

      const colorPalette = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];
      const seriesColor = colorPalette[index % colorPalette.length];

      return {
        x: xData,
        y: yData,
        name: yDataSource.alias ?? yColumnName,
        color: seriesColor,
        mode: (config.mode ?? "lines") as "lines" | "markers" | "lines+markers",
        line: {
          color: seriesColor,
          width: config.lineWidth ?? 2,
          shape: "linear" as const,
          smoothing: config.smoothing ?? 0,
        },
        marker: config.mode?.includes("markers")
          ? {
              color: seriesColor,
              size: 6,
            }
          : undefined,
        connectgaps: config.connectGaps ?? true,
      };
    });

    // Use the line chart config from the visualization
    const lineConfig = visualization.config as LineChartConfig;

    const chartConfig = {
      title: lineConfig.chartTitle ?? visualization.name,
      xAxisTitle: (lineConfig.xAxisTitle ?? xDataSources[0]?.alias ?? xColumn) as string,
      yAxisTitle: (lineConfig.yAxisTitle ??
        (yDataSources.length === 1
          ? (yDataSources[0]?.alias ?? yDataSources[0]?.columnName)
          : "Values")) as string,
      useWebGL: !isPreview && chartData.length > 1000,
      showLegend: true,
      showGrid: lineConfig.showGrid,
    };

    return <LineChart data={chartSeries} config={chartConfig} />;
  } catch (error) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 font-medium">Chart Configuration Error</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : "Invalid chart configuration"}
          </div>
        </div>
      </div>
    );
  }
}
