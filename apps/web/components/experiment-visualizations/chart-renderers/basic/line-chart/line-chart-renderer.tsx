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

    const xColumn = xDataSources[0].columnName;

    const chartConfig = visualization.config as PlotlyChartConfig & Omit<LineSeriesData, "x" | "y">;

    // Prepare chart data arrays using role-based approach
    const chartSeries: LineSeriesData[] = yDataSources.map((yDataSource, index) => {
      const xColumnName = xColumn;
      const yColumnName = yDataSource.columnName;

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

      const colorPalette = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];
      const defaultColor = colorPalette[index % colorPalette.length];

      return {
        x: xData,
        y: yData,
        name: yDataSource.alias ?? yColumnName,
        color: Array.isArray(chartConfig.color)
          ? chartConfig.color[index]
          : (chartConfig.color ?? defaultColor),
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

    return (
      <div style={{ height: `400px`, width: "100%" }}>
        <LineChart data={chartSeries} config={chartConfig} />{" "}
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
