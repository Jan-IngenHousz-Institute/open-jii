"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import type { BoxSeriesData } from "@repo/ui/components";
import { BoxPlot } from "@repo/ui/components";

interface BoxPlotConfig {
  chartTitle?: string;
  color?: string;
  orientation?: string;
  boxMode?: string;
  boxPoints?: string;
  notched?: boolean;
  fillOpacity?: number;
  markerSize?: number;
}

export interface BoxPlotRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function BoxPlotRenderer({
  visualization,
  data,
  height = 400,
  isPreview: _isPreview = false,
}: BoxPlotRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="mb-2 text-lg font-medium">{t("noDataAvailable")}</div>
          <div className="text-sm">{t("ensureExperimentHasData")}</div>
        </div>
      </div>
    );
  }

  try {
    // Ensure this is a box plot and we have data sources
    if (!visualization.config || visualization.chartType !== "box-plot") {
      throw new Error("Invalid chart type for box plot renderer");
    }

    // Extract configuration properties
    const config = visualization.config as BoxPlotConfig;

    // Get role-based data sources
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");

    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error("X-axis column not configured");
    }

    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error("Y-axis column not configured");
    }

    // Prepare box plot data using role-based approach
    const boxData: BoxSeriesData[] = yDataSources.map((yDataSource, index) => {
      const xColumnName = xDataSources[0].columnName;
      const yColumnName = yDataSource.columnName;

      // Get unique categories for grouped box plots
      const categories = [...new Set(data.map((row) => String(row[xColumnName])))];

      // Create separate arrays for each category
      const xValues: string[] = [];
      const yValues: number[] = [];

      categories.forEach((category) => {
        const categoryData = data
          .filter((row) => String(row[xColumnName]) === category)
          .map((row) => {
            const value = row[yColumnName];
            return typeof value === "number" ? value : parseFloat(String(value)) || 0;
          })
          .filter((val) => !isNaN(val));

        // Add category name for each data point
        categoryData.forEach((value) => {
          xValues.push(category);
          yValues.push(value);
        });
      });

      return {
        x: xValues,
        y: yValues,
        name: yDataSource.alias ?? yDataSource.columnName,
        type: "box" as const,
        boxpoints:
          (config.boxPoints as "all" | "outliers" | "suspectedoutliers" | "false" | undefined) ??
          "outliers",
        jitter: 0.3,
        pointpos: -1.8,
        notched: config.notched ?? false,
        marker: {
          color: config.color ?? ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"][index % 5],
          size: config.markerSize ?? 6,
          opacity: config.fillOpacity ?? 1.0,
        },
        line: {
          color: config.color ?? ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"][index % 5],
        },
      };
    });

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <BoxPlot
          data={boxData}
          orientation={(config.orientation as "v" | "h" | undefined) ?? "v"}
          boxmode={(config.boxMode as "group" | "overlay" | undefined) ?? "group"}
          config={{
            title: config.chartTitle ?? visualization.name,
            xAxisTitle: xDataSources[0].alias ?? xDataSources[0].columnName,
            yAxisTitle: yDataSources[0]?.alias ?? yDataSources[0]?.columnName,
            showLegend: yDataSources.length > 1,
            showGrid: true,
          }}
        />
      </div>
    );
  } catch (error) {
    console.error("Error rendering box plot:", error);
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-red-600">
          <div className="mb-2 text-lg font-medium">{t("errorRenderingChart")}</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : t("unknownError")}
          </div>
        </div>
      </div>
    );
  }
}
