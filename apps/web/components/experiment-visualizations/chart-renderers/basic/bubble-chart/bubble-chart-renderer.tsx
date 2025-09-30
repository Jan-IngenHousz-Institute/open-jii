"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { ScatterChart } from "@repo/ui/components";

interface BubbleChartConfig {
  chartTitle?: string;
  yAxisTitle?: string;
  color?: string;
  markerSizeMin?: number;
  markerSizeMax?: number;
  markerShape?: string;
  opacity?: number;
}

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
    // Ensure this is a bubble chart and we have data sources
    if (!visualization.config || visualization.chartType !== "bubble") {
      throw new Error("Invalid chart type for bubble chart renderer");
    }

    // Extract configuration properties
    const config = visualization.config as BubbleChartConfig;

    // Get role-based data sources
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");
    const sizeDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "size");

    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error(t("errors.xAxisNotConfigured"));
    }

    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error(t("errors.yAxisNotConfigured"));
    }

    if (!sizeDataSources.length || !sizeDataSources[0]?.columnName) {
      throw new Error(t("errors.sizeAxisNotConfigured"));
    }

    const xColumn = xDataSources[0].columnName;
    const sizeColumn = sizeDataSources[0].columnName;

    // Prepare bubble chart data using role-based approach
    const bubbleData = yDataSources.map((yDataSource, index) => {
      const xValues = data.map((row) => {
        const value = row[xColumn];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });
      const yValues = data.map((row) => {
        const value = row[yDataSource.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });
      const sizeValues = data.map((row) => {
        const value = row[sizeColumn];
        const num = typeof value === "number" ? value : parseFloat(String(value)) || 0;
        // Use configured size range or defaults
        const minSize = config.markerSizeMin ?? 5;
        const maxSize = config.markerSizeMax ?? 50;
        return Math.max(minSize, Math.min(maxSize, num));
      });

      return {
        x: xValues,
        y: yValues,
        name: yDataSource.alias ?? yDataSource.columnName,
        mode: "markers" as const,
        marker: {
          size: sizeValues,
          color: config.color ?? ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"][index % 5],
          symbol:
            (config.markerShape as
              | "circle"
              | "square"
              | "diamond"
              | "triangle-up"
              | "triangle-down"
              | undefined) ?? "circle",
          opacity: config.opacity ?? 0.7,
        },
        text: undefined, // Default to no text
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
            title: config.chartTitle ?? visualization.name,
            xAxisTitle: xDataSources[0]?.alias ?? xColumn,
            yAxisTitle:
              config.yAxisTitle ??
              (yDataSources.length === 1
                ? (yDataSources[0]?.alias ?? yDataSources[0]?.columnName)
                : "Values"),
            showLegend: true,
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
