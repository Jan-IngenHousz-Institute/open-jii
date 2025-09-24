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
    if (visualization.config.chartType !== "radar") {
      throw new Error("Invalid chart type for radar renderer");
    }

    const config = visualization.config.config;

    if (!config.categoryAxis.dataSource.columnName) {
      throw new Error(t("errors.categoryAxisNotConfigured"));
    }

    if (!config.series.length) {
      throw new Error(t("errors.noSeriesConfigured"));
    }

    // Extract categories from the data
    const categoryColumnName = config.categoryAxis.dataSource.columnName;
    const categories = [...new Set(data.map((row) => String(row[categoryColumnName])))];

    // Prepare radar chart data
    const radarData = config.series.map((series, index) => {
      const seriesColumnName = series.dataSource.columnName;

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
      const rValues = categories.map((category) => categoryValueMap.get(category) || 0);

      // For radar plots, we need to close the shape by repeating the first value
      const closedRValues = [...rValues, rValues[0]];

      // Create theta values (angles) for categories, with closing angle
      const thetaValues = categories.map((_, i) => (i * 360) / categories.length);
      const closedThetaValues = [...thetaValues, 360];

      return {
        r: closedRValues,
        theta: closedThetaValues,
        name: series.name || series.dataSource.alias || series.dataSource.columnName,
        color: series.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        mode: series.mode || "lines+markers",
        fill: series.fill || "toself",
        fillcolor: series.fillcolor || series.color || `hsl(${(index * 137.5) % 360}, 70%, 25%)`,
        opacity: series.opacity || 0.6,
        line: {
          color: series.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
          width: series.line?.width || 2,
          dash: series.line?.dash || "solid",
        },
        marker: {
          color: series.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
          size: series.marker?.size || 6,
          symbol: series.marker?.symbol || "circle",
        },
      };
    });

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <RadarPlot
          data={radarData}
          categories={categories}
          config={{
            title: config.display?.title ?? visualization.name,
            showLegend: config.display?.showLegend !== false,
            showModeBar: !_isPreview,
          }}
          rangeMode={config.rangeMode || "tozero"}
          gridShape={config.gridShape || "circular"}
          showTickLabels={config.showTickLabels !== false}
          tickAngle={config.tickAngle || 0}
          radialAxisVisible={config.radialAxisVisible !== false}
          angularAxisVisible={config.angularAxisVisible !== false}
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
