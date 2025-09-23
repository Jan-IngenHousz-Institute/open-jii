import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { LineChart } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";

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
    // Get chart configuration
    const config = visualization.config;
    if (config.chartType !== "line") {
      throw new Error("Invalid chart configuration");
    }

    const lineConfig = config.config;

    // Prepare chart data arrays
    const chartSeries = lineConfig.yAxes.map((yAxis, index) => {
      const xColumnName = lineConfig.xAxis.dataSource.columnName;
      const yColumnName = yAxis.dataSource.columnName;

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

      return {
        x: xData,
        y: yData,
        name: yAxis.title ?? yAxis.dataSource.alias ?? yColumnName,
        color: yAxis.color ?? `hsl(${index * 60}, 70%, 50%)`,
        mode: lineConfig.mode,
        line: {
          color: yAxis.color ?? `hsl(${index * 60}, 70%, 50%)`,
          width: 2,
        },
        marker: lineConfig.mode.includes("markers") ? { size: 6 } : undefined,
      };
    });

    const chartConfig = {
      title: lineConfig.display?.title ?? visualization.name,
      xAxisTitle: lineConfig.xAxis.title ?? lineConfig.xAxis.dataSource.columnName,
      yAxisTitle: lineConfig.yAxes[0]?.title ?? "Values",
      useWebGL: !isPreview && chartData.length > 1000,
      showLegend: lineConfig.display?.showLegend ?? true,
      interactive: lineConfig.display?.interactive ?? true,
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
