import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import type { PlotlyChartConfig } from "@repo/ui/components";
import { Histogram } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";

interface HistogramConfig {
  nbins?: number;
  barmode?: string;
  orientation?: string;
  autobinx?: boolean;
  histfunc?: string;
  histnorm?: string;
  opacity?: number;
  gridLines?: boolean;
  title?: string;
  showLegend?: boolean;
  legendPosition?: string;
  colorScheme?: string;
}

interface HistogramChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height: number;
  isPreview: boolean;
}

export function HistogramChartRenderer({
  visualization,
  experimentId,
  data: providedData,
  height: _height,
  isPreview,
}: HistogramChartRendererProps) {
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
    // Ensure this is a histogram chart and we have data sources
    if (!visualization.config || visualization.chartType !== "histogram") {
      throw new Error("Invalid chart type for histogram chart renderer");
    }

    // Extract configuration properties
    const config = visualization.config as HistogramConfig;

    // Get role-based data sources (histogram typically uses 'values' role)
    const valueDataSources = visualization.dataConfig.dataSources.filter(
      (ds) => ds.role === "values",
    );

    if (!valueDataSources.length || !valueDataSources[0]?.columnName) {
      throw new Error("Values column not configured");
    }

    const histogramSeries = valueDataSources.map((dataSource) => {
      const columnName = dataSource.columnName;

      // Extract the data for this series
      const seriesData = chartData.map((row) => {
        const value = row[columnName];
        if (typeof value === "number") {
          return value;
        }
        if (typeof value === "string") {
          const num = Number(value);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      });

      return {
        x: seriesData,
        name: dataSource.alias ?? columnName,
        color: config.colorScheme ?? "#3b82f6",
        opacity: config.opacity ?? 0.7,

        // Histogram configuration
        nbinsx: config.nbins ?? 20,
        autobinx: config.autobinx ?? true,
        histfunc:
          (config.histfunc as "count" | "sum" | "avg" | "min" | "max" | undefined) ?? "count",
        histnorm:
          (config.histnorm as
            | ""
            | "percent"
            | "probability"
            | "density"
            | "probability density"
            | undefined) ?? "",
        orientation: (config.orientation as "v" | "h" | undefined) ?? "v",

        // Marker styling
        marker: {
          color: config.colorScheme ?? "#3b82f6",
          opacity: config.opacity ?? 0.7,
        },
      };
    });

    const chartConfig: PlotlyChartConfig = {
      title: config.title ?? visualization.name,
      xAxisTitle: "Values",
      yAxisTitle: "Frequency",
      useWebGL: !isPreview && chartData.length > 1000,
      showLegend: config.showLegend ?? histogramSeries.length > 1,
      showGrid: config.gridLines ?? true,
    };

    return (
      <Histogram
        data={histogramSeries}
        config={chartConfig}
        barmode={(config.barmode as "group" | "overlay" | "stack" | undefined) ?? "overlay"}
        orientation={(config.orientation as "v" | "h" | undefined) ?? "v"}
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
