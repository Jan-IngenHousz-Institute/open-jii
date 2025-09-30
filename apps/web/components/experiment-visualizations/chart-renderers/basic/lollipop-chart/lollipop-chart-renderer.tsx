"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { LollipopChart } from "@repo/ui/components";

interface LollipopChartConfig {
  chartTitle?: string;
  color?: string;
  orientation?: string;
  stemWidth?: number;
  dotSize?: number;
  opacity?: number;
}

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
    // Ensure this is a lollipop chart and we have data sources
    if (!visualization.config || visualization.chartType !== "lollipop") {
      throw new Error("Invalid chart type for lollipop chart renderer");
    }

    // Extract configuration properties
    const config = visualization.config as LollipopChartConfig;

    // Get role-based data sources
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");

    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error("X-axis column not configured");
    }

    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error("Y-axis column not configured");
    }

    const xColumnName = xDataSources[0].columnName;
    const yColumnName = yDataSources[0].columnName;

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
        name={yDataSources[0]?.alias ?? yColumnName}
        color={config.color ?? "#3b82f6"}
        orientation={(config.orientation as "v" | "h" | undefined) ?? "v"}
        stemWidth={config.stemWidth ?? 2}
        dotSize={config.dotSize ?? 8}
        config={{
          title: config.chartTitle ?? visualization.name,
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
