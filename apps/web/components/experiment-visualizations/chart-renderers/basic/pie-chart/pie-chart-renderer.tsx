import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { PieChart } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";

interface PieChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height: number;
  isPreview: boolean;
}

export function PieChartRenderer({
  visualization,
  experimentId,
  data: providedData,
  height: _height,
  isPreview: _isPreview,
}: PieChartRendererProps) {
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
    // Ensure this is a pie chart and we have data sources
    if (!visualization.config || visualization.chartType !== "pie") {
      throw new Error("Invalid chart type for pie chart renderer");
    }

    // Get role-based data sources
    const labelDataSources = visualization.dataConfig.dataSources.filter(
      (ds) => ds.role === "labels",
    );
    const valueDataSources = visualization.dataConfig.dataSources.filter(
      (ds) => ds.role === "values",
    );

    if (!labelDataSources.length || !labelDataSources[0]?.columnName) {
      throw new Error("Label column not configured");
    }

    if (!valueDataSources.length || !valueDataSources[0]?.columnName) {
      throw new Error("Value column not configured");
    }

    const labelColumnName = labelDataSources[0].columnName;
    const valueColumnName = valueDataSources[0].columnName;

    // Extract config properties from the configurator
    interface PieConfigType {
      showLabels?: boolean;
      showValues?: boolean;
      textPosition?: string;
      hole?: number;
      pull?: number;
    }

    const config = visualization.config as PieConfigType;

    const labels = chartData.map((row) => {
      const value = row[labelColumnName];
      return typeof value === "string" || typeof value === "number" ? String(value) : "Unknown";
    });

    const values = chartData.map((row) => {
      const value = row[valueColumnName];
      if (typeof value === "number") {
        return value;
      }
      if (typeof value === "string") {
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    });

    // Generate textinfo based on configurator settings
    const textInfoParts: string[] = [];
    if (config.showLabels) textInfoParts.push("label");
    if (config.showValues) textInfoParts.push("percent");
    const textinfo = textInfoParts.length > 0 ? textInfoParts.join("+") : "none";

    const pieData = [
      {
        labels,
        values,
        type: "pie" as const,
        hole: config.hole ?? 0,
        textinfo: textinfo as
          | "label"
          | "text"
          | "value"
          | "percent"
          | "none"
          | "label+percent"
          | "label+text"
          | "label+value",
        textposition: (config.textPosition ?? "auto") as "inside" | "outside" | "auto" | "none",
        pull: config.pull ?? 0,
      },
    ];

    const chartConfig = {
      title: visualization.name,
      useWebGL: false,
      showLegend: true,
      interactive: true,
    };

    return <PieChart data={pieData} config={chartConfig} />;
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
