import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import type { PlotlyChartConfig } from "@repo/ui/components";
import { Histogram } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";

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
    const config = visualization.config;
    if (config.chartType !== "histogram") {
      throw new Error("Invalid chart configuration");
    }

    const histogramConfig = config.config;

    const histogramSeries = histogramConfig.series.map((series) => {
      const columnName = series.dataSource.columnName;

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
        name: series.name ?? series.dataSource.alias ?? columnName,
        color: series.color,
        opacity: series.opacity,

        // Histogram configuration
        nbinsx: histogramConfig.nbins,
        autobinx: histogramConfig.autobinx,
        histfunc: series.histfunc ?? "count",
        histnorm:
          series.histnorm ??
          ("" as "" | "percent" | "probability" | "density" | "probability density"),
        orientation: histogramConfig.orientation,

        // Binning configuration
        xbins: histogramConfig.xbins,

        // Marker styling
        marker: {
          color: series.color,
          opacity: series.opacity,
        },
      };
    });

    const chartConfig: PlotlyChartConfig = {
      title: histogramConfig.display?.title ?? visualization.name,
      xAxisTitle: "Values",
      yAxisTitle: histogramConfig.orientation === "h" ? "Values" : "Frequency",
      useWebGL: !isPreview && chartData.length > 1000,
      showLegend: histogramConfig.display?.showLegend ?? histogramSeries.length > 1,
      // Grid lines configuration
      showGrid: histogramConfig.gridLines !== "none",
    };

    return (
      <Histogram
        data={histogramSeries}
        config={chartConfig}
        barmode={histogramConfig.barmode}
        orientation={histogramConfig.orientation}
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
