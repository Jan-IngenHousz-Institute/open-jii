"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { ScatterChart } from "@repo/ui/components";

export interface BubbleChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function BubbleChartRenderer({
  visualization,
  data,
  height = 400,
  isPreview: _isPreview = false,
}: BubbleChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="mb-2 text-lg font-medium">{t("errors.noData")}</div>
          <div className="text-sm">{t("errors.noDataDescription")}</div>
        </div>
      </div>
    );
  }

  try {
    // Type-safe config access
    if (visualization.config.chartType !== "bubble") {
      throw new Error("Invalid chart type for bubble renderer");
    }

    const config = visualization.config.config;

    if (!config.xAxis.dataSource.columnName) {
      throw new Error(t("errors.xAxisNotConfigured"));
    }

    if (!config.yAxes.length || !config.yAxes[0]?.dataSource.columnName) {
      throw new Error(t("errors.yAxisNotConfigured"));
    }

    if (!config.sizeAxis.dataSource.columnName) {
      throw new Error(t("errors.sizeAxisNotConfigured"));
    }

    // Prepare bubble chart data
    const bubbleData = config.yAxes.map((yAxis, index) => {
      const xValues = data.map((row) => {
        const value = row[config.xAxis.dataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });
      const yValues = data.map((row) => {
        const value = row[yAxis.dataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });
      const sizeValues = data.map((row) => {
        const value = row[config.sizeAxis.dataSource.columnName];
        const num = typeof value === "number" ? value : parseFloat(String(value)) || 0;
        return Math.max(config.markerSizeScale.min, Math.min(config.markerSizeScale.max, num));
      });

      return {
        x: xValues,
        y: yValues,
        name: yAxis.dataSource.alias ?? yAxis.dataSource.columnName,
        mode: config.mode,
        marker: {
          size: sizeValues,
          color: yAxis.color ?? `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
          symbol: config.markerShape,
          opacity: config.opacity,
        },
        text: config.mode === "markers+text" ? sizeValues.map(String) : undefined,
        textposition: "middle center" as const,
        textfont: {
          family: "Inter, Arial, sans-serif",
          color: "white",
          size: 12,
        },
        type: "scatter" as const,
      };
    });

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <ScatterChart
          data={bubbleData}
          config={{
            title: config.display?.title ?? visualization.name,
            xAxisTitle: config.xAxis.title ?? config.xAxis.dataSource.columnName,
            yAxisTitle:
              config.yAxes.length === 1
                ? (config.yAxes[0].title ?? config.yAxes[0].dataSource.columnName)
                : "Values",
            showLegend: config.display?.showLegend ?? true,
            responsive: true,
          }}
        />
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
