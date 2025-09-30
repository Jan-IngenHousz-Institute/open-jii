import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import type { PlotlyChartConfig } from "@repo/ui/components";
import { BarChart } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import type { BarChartConfig } from "../../../types/chart-config-types";

interface BarChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height: number;
  isPreview: boolean;
}

export function BarChartRenderer({
  visualization,
  experimentId,
  data: providedData,
  height: _height,
  isPreview,
}: BarChartRendererProps) {
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
    // Ensure this is a bar chart and we have data sources
    if (!visualization.config || visualization.chartType !== "bar") {
      throw new Error("Invalid chart type for bar chart renderer");
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
    interface BarConfigType {
      orientation?: string;
      barMode?: string;
      barWidth?: number;
      showValues?: boolean;
    }

    const config = visualization.config as BarConfigType;

    const chartSeries = yDataSources.map((yDataSource, index) => {
      const xColumnName = xColumn;
      const yColumnName = yDataSource.columnName;

      const xData = chartData.map((row) => {
        const value = row[xColumnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      const yData = chartData.map((row) => {
        const value = row[yColumnName];
        if (typeof value === "number") {
          return value;
        }
        if (typeof value === "string") {
          const num = Number(value);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      });

      const orientation: "h" | "v" = config.orientation === "horizontal" ? "h" : "v";

      return {
        x: xData,
        y: yData,
        name: yDataSource.alias ?? yColumnName,
        color: ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"][index % 5],
        type: "bar" as const,
        orientation,
        text: config.showValues ? yData.map(String) : undefined,
        textposition: config.showValues ? ("auto" as const) : undefined,
        width: config.barWidth,
      };
    });

    // Use the bar chart config from the visualization
    const barConfig = visualization.config as BarChartConfig;

    // Map barMode from configurator to component API
    const barMode =
      config.barMode === "stack" ? "stack" : config.barMode === "overlay" ? "overlay" : "group";

    const chartConfig: PlotlyChartConfig = {
      title: barConfig.chartTitle ?? visualization.name,
      xAxisTitle: (barConfig.xAxisTitle ?? xDataSources[0]?.alias ?? xColumn) as string,
      yAxisTitle: (barConfig.yAxisTitle ??
        (yDataSources.length === 1
          ? (yDataSources[0]?.alias ?? yDataSources[0]?.columnName)
          : "Values")) as string,
      useWebGL: !isPreview && chartData.length > 1000,
      showLegend: true,
      showGrid: barConfig.showGrid,
    };

    return (
      <BarChart
        data={chartSeries}
        config={chartConfig}
        barmode={barMode as "stack" | "group" | "overlay" | "relative"}
      />
    );
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
