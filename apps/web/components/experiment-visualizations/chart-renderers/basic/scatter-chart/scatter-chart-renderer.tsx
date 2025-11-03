"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import type { PlotlyChartConfig, ScatterSeriesData } from "@repo/ui/components";
import { ScatterChart } from "@repo/ui/components";

export interface ScatterChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
}

export function ScatterChartRenderer({ visualization, data }: ScatterChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="mb-2 text-lg font-medium">{t("errors.noData")}</div>
          <div className="text-sm">{t("errors.noDataFound")}</div>
        </div>
      </div>
    );
  }

  try {
    // Ensure this is a scatter chart and we have data sources
    if (!visualization.config || visualization.chartType !== "scatter") {
      throw new Error(t("errors.invalidChartType"));
    }

    // Get role-based data sources
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");
    const colorDataSources = visualization.dataConfig.dataSources.filter(
      (ds) => ds.role === "color",
    );

    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error(t("errors.xAxisNotConfigured"));
    }

    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error(t("errors.yAxisNotConfigured"));
    }

    const xColumn = xDataSources[0].columnName;

    // Get the chart config directly - it's already in the right format
    const chartConfig = visualization.config as PlotlyChartConfig &
      Omit<ScatterSeriesData, "x" | "y">;

    const scatterData: ScatterSeriesData[] = yDataSources.map((yDataSource, index) => {
      const xValues = data.map((row) => {
        const value = row[xColumn];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });
      const yValues = data.map((row) => {
        const value = row[yDataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      // Handle color mapping if color role is configured
      let colorValues: string[] | undefined;
      if (colorDataSources.length > 0 && colorDataSources[0]?.columnName) {
        colorValues = data.map((row) => {
          const value = row[colorDataSources[0].columnName];
          return String(value);
        });
      }

      const colorPalette = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];
      const defaultColor = colorPalette[index % colorPalette.length];

      return {
        x: xValues,
        y: yValues,
        name: yDataSource.alias ?? yDataSource.columnName,
        mode: chartConfig.mode,
        marker: {
          size: chartConfig.marker?.size,
          symbol: chartConfig.marker?.symbol,
          color: colorValues ?? chartConfig.color ?? defaultColor,
          colorscale: colorValues ? chartConfig.marker?.colorscale : undefined,
          showscale: colorValues ? chartConfig.marker?.showscale : undefined,
          ...(colorValues &&
            chartConfig.marker?.showscale && {
              colorbar: {
                title: {
                  text: chartConfig.marker.colorbar?.title?.text,
                  font: {
                    color: chartConfig.marker.colorbar?.title?.font?.color,
                    size: chartConfig.marker.colorbar?.title?.font?.size,
                    family: chartConfig.marker.colorbar?.title?.font?.family,
                  },
                  side: chartConfig.marker.colorbar?.title?.side,
                },
                thickness: 15,
                len: 0.9,
              },
            }),
        },
        line: chartConfig.line,
        text: chartConfig.text,
        textposition: chartConfig.textposition,
        textfont: chartConfig.textfont,
        error_x: chartConfig.error_x,
        error_y: chartConfig.error_y,
        fill: chartConfig.fill,
        fillcolor: chartConfig.fillcolor,
        type: "scatter",
      };
    });

    return (
      <div style={{ height: `400px`, width: "100%" }}>
        <ScatterChart data={scatterData} config={chartConfig} />
      </div>
    );
  } catch (error) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium">{t("errors.configurationError")}</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : t("errors.invalidConfiguration")}
          </div>
        </div>
      </div>
    );
  }
}
