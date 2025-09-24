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
    if (visualization.config.chartType !== "log-plot") {
      throw new Error(`Expected log-plot, got ${visualization.config.chartType}`);
    }

    const config = visualization.config.config;

    // Validate required columns
    if (!config.xAxis.dataSource.columnName) {
      throw new Error("X-axis column is required");
    }

    if (!config.yAxes.length || !config.yAxes[0]?.dataSource.columnName) {
      throw new Error("At least one Y-axis series is required");
    }

    const xColumnName = config.xAxis.dataSource.columnName;

    // Extract x-axis data
    const xData = data.map((row) => row[xColumnName]);

    // Prepare series data for each Y-axis
    const seriesData = config.yAxes.map((yAxis, index) => {
      const yColumnName = yAxis.dataSource.columnName;
      const yData = data
        .map((row) => {
          const value = row[yColumnName];
          return typeof value === "number" ? value : null;
        })
        .filter((val): val is number => val !== null);

      return {
        x: xData.slice(0, yData.length), // Match array lengths
        y: yData,
        name: yAxis.title ?? yAxis.dataSource.alias ?? yColumnName,
        color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        mode: "lines+markers" as const,
        line: {
          width: 2,
        },
        marker: {
          size: 6,
        },
      };
    });

    // Determine axis types - default Y to log scale for log plots
    const xAxisType = config.xAxis.type;
    const yAxisType = config.yAxes[0]?.type ?? "log";

    return (
      <LogPlot
        data={seriesData}
        xAxisType={xAxisType}
        yAxisType={yAxisType}
        config={{
          title: config.display?.title ?? visualization.name,
          xAxisTitle: config.xAxis.title,
          yAxisTitle: config.yAxes[0]?.title,
          showModeBar: config.display?.interactive ?? true,
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
