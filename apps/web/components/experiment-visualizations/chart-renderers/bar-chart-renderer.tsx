import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { BarChart, PlotlyChartConfig } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";

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
    const config = visualization.config;
    if (config.chartType !== "bar") {
      throw new Error("Invalid chart configuration");
    }

    const barConfig = config.config;

    const chartSeries = barConfig.yAxes.map((yAxis, index) => {
      const xColumnName = barConfig.xAxis.dataSource.columnName;
      const yColumnName = yAxis.dataSource.columnName;

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

      const orientation: "h" | "v" = barConfig.orientation === "horizontal" ? "h" : "v";

      return {
        x: xData,
        y: yData,
        name: yAxis.title ?? yAxis.dataSource.alias ?? yColumnName,
        color: yAxis.color ?? `hsl(${index * 60}, 70%, 50%)`,
        type: "bar" as const,
        orientation,
      };
    });

    const chartConfig: PlotlyChartConfig = {
      title: barConfig.display?.title ?? visualization.name,
      xAxisTitle: barConfig.xAxis.title ?? barConfig.xAxis.dataSource.columnName,
      yAxisTitle: barConfig.yAxes[0]?.title ?? "Values",
      useWebGL: !isPreview && chartData.length > 1000,
      showLegend: barConfig.display?.showLegend ?? true,
    };

    return <BarChart data={chartSeries} config={chartConfig} />;
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
