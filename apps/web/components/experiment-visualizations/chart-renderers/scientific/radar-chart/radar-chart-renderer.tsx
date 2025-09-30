"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { RadarPlot } from "@repo/ui/components";

export interface RadarChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function RadarChartRenderer({
  visualization,
  data,
  height = 400,
  isPreview: _isPreview = false,
}: RadarChartRendererProps) {
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
    if (!visualization.config || visualization.chartType !== "radar") {
      throw new Error("Invalid chart type for radar renderer");
    }

    // Get role-based data sources
    const labelsDataSources = visualization.dataConfig.dataSources.filter(
      (ds) => ds.role === "labels",
    );
    const valuesDataSources = visualization.dataConfig.dataSources.filter(
      (ds) => ds.role === "values",
    );

    if (!labelsDataSources.length || !labelsDataSources[0]?.columnName) {
      throw new Error(t("errors.categoryAxisNotConfigured"));
    }

    if (!valuesDataSources.length) {
      throw new Error(t("errors.noSeriesConfigured"));
    }

    // Extract categories from the data
    const categoryColumnName = labelsDataSources[0].columnName;
    const categories = [...new Set(data.map((row) => String(row[categoryColumnName])))];

    // Prepare radar chart data
    const radarData = valuesDataSources.map((valuesDataSource, index) => {
      const seriesColumnName = valuesDataSource.columnName;

      if (!seriesColumnName) {
        throw new Error(t("errors.seriesColumnNotConfigured", { index: index + 1 }));
      }

      // Create a map of category to value for this series
      const categoryValueMap = new Map<string, number>();
      data.forEach((row) => {
        const category = String(row[categoryColumnName]);
        const value = row[seriesColumnName];
        const numValue = typeof value === "number" ? value : parseFloat(String(value)) || 0;
        categoryValueMap.set(category, numValue);
      });

      // Create r values in the same order as categories
      const rValues = categories.map((category) => categoryValueMap.get(category) ?? 0);

      // For radar plots, we need to close the shape by repeating the first value
      const closedRValues = [...rValues, rValues[0]];

      // Create theta values (angles) for categories, with closing angle
      const thetaValues = categories.map((_, i) => (i * 360) / categories.length);
      const closedThetaValues = [...thetaValues, 360];

      const colorPalette = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];
      const seriesColor = colorPalette[index % colorPalette.length];

      return {
        theta: categories,
        r: rValues,
        name: valuesDataSource.alias ?? seriesColumnName,
        color: seriesColor,
        type: "scatterpolar" as const,
        mode: "lines+markers" as const,
        fillcolor: `${seriesColor}40`, // Add transparency with hex
        fill: "toself" as const,
        line: {
          color: seriesColor,
          width: 2,
        },
        marker: {
          color: seriesColor,
          size: 6,
        },
      };
    });

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <RadarPlot
          data={radarData}
          categories={categories}
          config={{
            title: visualization.name,
            showLegend: valuesDataSources.length > 1,
            showModeBar: !_isPreview,
          }}
          rangeMode="tozero"
          gridShape="circular"
          showTickLabels={true}
          tickAngle={0}
          radialAxisVisible={true}
          angularAxisVisible={true}
        />
      </div>
    );
  } catch (error) {
    console.error("Error rendering radar chart:", error);
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-destructive text-center">
          <div className="mb-2 text-lg font-medium">{t("errors.renderError")}</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : t("errors.unknownError")}
          </div>
        </div>
      </div>
    );
  }
}
