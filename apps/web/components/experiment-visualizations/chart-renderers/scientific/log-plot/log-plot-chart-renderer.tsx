"use client";

import type { ExperimentVisualization } from "@repo/api";
import { LogPlot } from "@repo/ui/components";

export interface LogPlotChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function LogPlotChartRenderer({
  visualization,
  data,
  height = 400,
  isPreview: _isPreview = false,
}: LogPlotChartRendererProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-muted/50 flex h-full items-center justify-center rounded-lg border-2 border-dashed">
        <div className="text-center">
          <div className="text-lg font-medium">No data available</div>
          <div className="text-muted-foreground text-sm">
            Please configure your data sources and ensure data is available
          </div>
        </div>
      </div>
    );
  }

  try {
    // Ensure this is a log plot
    if (!visualization.config || visualization.chartType !== "log-plot") {
      throw new Error(`Expected log-plot, got ${visualization.chartType}`);
    }

    // Get role-based data sources
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");

    // Validate required columns
    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error("X-axis column is required");
    }

    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error("At least one Y-axis series is required");
    }

    const xColumnName = xDataSources[0].columnName;

    // Extract x-axis data
    const xData = data.map((row) => row[xColumnName]);

    // Prepare series data for each Y-axis
    const seriesData = yDataSources.map((yDataSource, index) => {
      const yColumnName = yDataSource.columnName;
      const yData = data
        .map((row) => {
          const value = row[yColumnName];
          return typeof value === "number" ? value : null;
        })
        .filter((val): val is number => val !== null);

      return {
        x: xData.slice(0, yData.length), // Match array lengths
        y: yData,
        name: yDataSource.alias ?? yColumnName,
        color: ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"][index % 5],
        mode: "markers" as const,
        line: {
          width: 2,
        },
        marker: {
          size: 6,
        },
      };
    });

    return (
      <LogPlot
        data={seriesData}
        xAxisType="linear"
        yAxisType="log"
        config={{
          title: visualization.name,
          xAxisTitle: xDataSources[0].alias ?? xDataSources[0].columnName,
          yAxisTitle: yDataSources[0]?.alias ?? yDataSources[0]?.columnName,
          showModeBar: true,
          height,
        }}
      />
    );
  } catch (error) {
    console.error("Error rendering log plot:", error);
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium">Error rendering chart</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </div>
        </div>
      </div>
    );
  }
}
