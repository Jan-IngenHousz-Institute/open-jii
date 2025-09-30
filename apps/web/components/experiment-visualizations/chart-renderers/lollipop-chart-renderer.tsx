"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { LollipopChart } from "@repo/ui/components";

export interface LollipopChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function LollipopChartRenderer({
  visualization,
  data,
  height = 400,
  isPreview: _isPreview = false,
}: LollipopChartRendererProps) {
  if (!data || data.length === 0) {
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
    // Ensure this is a lollipop chart and get configuration with proper typing
    if (visualization.config.chartType !== "lollipop") {
      throw new Error("Invalid chart type for lollipop renderer");
    }

    const config = visualization.config.config;

    if (!config.xAxis.dataSource.columnName) {
      throw new Error("X-axis column not configured");
    }

    if (!config.yAxes.length || !config.yAxes[0]?.dataSource.columnName) {
      throw new Error("Y-axis column not configured");
    }

    const xColumnName = config.xAxis.dataSource.columnName;
    const yColumnName = config.yAxes[0].dataSource.columnName;

    // Extract categories and values from the data
    const categories = data.map((row) => {
      const value = row[xColumnName];
      if (value == null) return "";
      if (typeof value === "string" || typeof value === "number") return String(value);
      return "";
    });

    const values = data.map((row) => {
      const value = row[yColumnName];
      return typeof value === "number" ? value : Number(value) || 0;
    });

    return (
      <LollipopChart
        categories={categories}
        values={values}
        name={config.yAxes[0]?.title ?? config.yAxes[0]?.dataSource.alias ?? yColumnName}
        color={config.yAxes[0]?.color ?? "#3b82f6"}
        orientation={config.orientation}
        stemWidth={config.stemWidth || 2}
        dotSize={config.dotSize || 8}
        config={{
          title: config.display?.title ?? visualization.name,
          height,
        }}
      />
    );
  } catch (error) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border-2 border-dashed">
        <div className="text-center">
          <div className="mb-2 font-medium">Chart Error</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </div>
        </div>
      </div>
    );
  }
}
