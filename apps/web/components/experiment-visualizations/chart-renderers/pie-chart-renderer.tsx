import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { PieChart } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";

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
  isPreview,
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
    const config = visualization.config;
    if (config.chartType !== "pie") {
      throw new Error("Invalid chart configuration");
    }

    const pieConfig = config.config;

    const labelColumnName = pieConfig.labelSource.columnName;
    const valueColumnName = pieConfig.valueSource.columnName;

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

    const pieData = [
      {
        labels,
        values,
        type: "pie" as const,
        hole: pieConfig.hole,
        // Enhanced textinfo to support showValues
        textinfo: (() => {
          if (pieConfig.showLabels && pieConfig.showValues) {
            return "label+value+percent" as const;
          } else if (pieConfig.showLabels) {
            return "label+percent" as const;
          } else if (pieConfig.showValues) {
            return "value+percent" as const;
          } else {
            return "percent" as const;
          }
        })(),
        textposition: pieConfig.textPosition,
        // Add support for pull (slice separation)
        pull: pieConfig.pull > 0 ? Array(labels.length).fill(pieConfig.pull) : undefined,
      },
    ];

    const chartConfig = {
      title: pieConfig.display?.title ?? visualization.name,
      useWebGL: !isPreview && chartData.length > 1000,
      showLegend: pieConfig.display?.showLegend ?? true,
      interactive: pieConfig.display?.interactive ?? true,
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
