import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import type { LineSeriesData, PlotlyChartConfig } from "@repo/ui/components";
import { LineChart } from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";

interface LineChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
}

export function LineChartRenderer({
  visualization,
  experimentId,
  data: providedData,
}: LineChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Get X-axis column for ordering
  const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
  const xColumn = xDataSources[0]?.columnName;

  // Fetch data if not provided - always order by X-axis column
  const {
    data: fetchedData,
    isLoading,
    error,
  } = useExperimentVisualizationData(
    experimentId,
    {
      tableName: visualization.dataConfig.tableName,
      columns: visualization.dataConfig.dataSources.map((ds) => ds.columnName),
      orderBy: xColumn,
      orderDirection: "ASC",
    },
    !providedData, // Only fetch if data not provided
  );

  // Use provided data or fetched data - simplified for now
  const chartData = providedData ?? fetchedData?.rows ?? [];

  if (isLoading && !providedData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t("errors.loadingData")}</div>
      </div>
    );
  }

  if (error && !providedData) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 font-medium">{t("errors.failedToLoadData")}</div>
          <div className="text-sm">{t("errors.failedToLoadDataDescription")}</div>
        </div>
      </div>
    );
  }

  if (!Array.isArray(chartData) || chartData.length === 0) {
    return (
      <div className="bg-muted/20 flex h-full items-center justify-center rounded-lg border-2 border-dashed">
        <div className="text-center">
          <div className="text-muted-foreground mb-2 font-medium">{t("errors.noData")}</div>
          <div className="text-muted-foreground text-sm">{t("errors.noDataFound")}</div>
        </div>
      </div>
    );
  }

  try {
    // Ensure this is a line chart and we have data sources
    if (!visualization.config || visualization.chartType !== "line") {
      throw new Error(t("errors.invalidConfiguration"));
    }

    // Get role-based data sources
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");

    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error(t("errors.xAxisNotConfigured"));
    }

    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error(t("errors.yAxisNotConfigured"));
    }

    const chartConfig = visualization.config as PlotlyChartConfig & Omit<LineSeriesData, "x" | "y">;

    // Data is already sorted by backend, so use directly
    // Prepare chart data arrays using role-based approach
    const chartSeries: LineSeriesData[] = yDataSources.map((yDataSource, index) => {
      const xData = chartData.map((row) => {
        const value = row[xColumn];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      const yData = chartData.map((row) => {
        const value = row[yDataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      // Determine which Y-axis this series should use
      const yaxis =
        index === 0
          ? "y"
          : index === 1
            ? "y2"
            : index === 2
              ? "y3"
              : index === 3
                ? "y4"
                : index === 4
                  ? "y5"
                  : "y6";

      return {
        x: xData,
        y: yData,
        name: yDataSource.alias ?? yDataSource.columnName,
        color: Array.isArray(chartConfig.color) ? chartConfig.color[index] : chartConfig.color,
        yaxis,
        mode: chartConfig.mode,
        line: chartConfig.line,
        marker: chartConfig.marker,
        connectgaps: chartConfig.connectgaps,
        fill: chartConfig.fill,
        fillcolor: chartConfig.fillcolor,
        text: chartConfig.text,
        textposition: chartConfig.textposition,
        textfont: chartConfig.textfont,
        error_x: chartConfig.error_x,
        error_y: chartConfig.error_y,
      };
    });

    // Update yAxis array with colors from series
    const yAxis = chartConfig.yAxis || [];
    const updatedYAxis = chartSeries.map((series, index) => {
      const seriesColor = typeof series.color === "string" ? series.color : "#3b82f6";
      return {
        title: yAxis[index]?.title || "",
        type: yAxis[index]?.type || "linear",
        color: seriesColor,
      };
    });

    return (
      <div className="flex h-full w-full flex-col">
        <LineChart data={chartSeries} config={{ ...chartConfig, yAxis: updatedYAxis }} />
      </div>
    );
  } catch (error) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 font-medium">{t("errors.configurationError")}</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : t("errors.invalidConfiguration")}
          </div>
        </div>
      </div>
    );
  }
}
