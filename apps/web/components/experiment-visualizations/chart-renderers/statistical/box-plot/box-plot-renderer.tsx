"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import type { BoxSeriesData } from "@repo/ui/components";
import { BoxPlot } from "@repo/ui/components";

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
    // Type-safe config access
    if (visualization.config.chartType !== "box-plot") {
      throw new Error("Invalid chart type for box plot renderer");
    }

    const config = visualization.config.config;

    if (!config.xAxis.dataSource.columnName) {
      throw new Error("X-axis column not configured");
    }

    if (!config.yAxes.length || !config.yAxes[0]?.dataSource.columnName) {
      throw new Error("Y-axis column not configured");
    }

    // Prepare box plot data
    const boxData: BoxSeriesData[] = config.yAxes.map((yAxis, index) => {
      // For box plots, we need to handle both grouped and ungrouped data
      if (config.xAxis.type === "category") {
        // Group data by x-axis categories
        const xColumnName = config.xAxis.dataSource.columnName;
        const yColumnName = yAxis.dataSource.columnName;

        // Get unique categories
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
          name: yAxis.dataSource.alias ?? yAxis.dataSource.columnName,
          boxpoints: config.boxPoints,
          jitter: config.jitter,
          pointpos: config.pointPos,
          notched: config.notched,
          notchwidth: config.notchWidth,
          boxmean:
            config.boxMean === "false"
              ? false
              : config.boxMean === "true"
                ? true
                : (config.boxMean as "sd"),
          orientation: config.orientation,
          fillcolor: yAxis.color
            ? `${yAxis.color}${Math.round(config.fillOpacity * 255)
                .toString(16)
                .padStart(2, "0")}`
            : undefined,
          line: {
            color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
            width: config.lineWidth,
          },
          marker: {
            size: config.markerSize,
            color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
            opacity: 0.7,
          },
          color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        };
      } else {
        // Single box plot for continuous x-axis
        const yValues = data
          .map((row) => {
            const value = row[yAxis.dataSource.columnName];
            return typeof value === "number" ? value : parseFloat(String(value)) || 0;
          })
          .filter((val) => !isNaN(val));

        return {
          y: yValues,
          name: yAxis.dataSource.alias ?? yAxis.dataSource.columnName,
          boxpoints: config.boxPoints,
          jitter: config.jitter,
          pointpos: config.pointPos,
          notched: config.notched,
          notchwidth: config.notchWidth,
          boxmean:
            config.boxMean === "false"
              ? false
              : config.boxMean === "true"
                ? true
                : (config.boxMean as "sd"),
          orientation: config.orientation,
          fillcolor: yAxis.color
            ? `${yAxis.color}${Math.round(config.fillOpacity * 255)
                .toString(16)
                .padStart(2, "0")}`
            : undefined,
          line: {
            color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
            width: config.lineWidth,
          },
          marker: {
            size: config.markerSize,
            color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
            opacity: 0.7,
          },
          color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        };
      }
    });

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <BoxPlot
          data={boxData}
          orientation={config.orientation}
          boxmode={config.boxMode}
          config={{
            title: config.display?.title ?? visualization.name,
            xAxisTitle: config.xAxis.title ?? config.xAxis.dataSource.columnName,
            yAxisTitle: config.yAxes[0]?.title ?? config.yAxes[0]?.dataSource.columnName,
            showLegend: config.display?.showLegend ?? true,
            showGrid: config.gridLines !== "none",
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
