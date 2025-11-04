"use client";

import dynamic from "next/dynamic";
import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";

import { LineChartRenderer } from "./chart-renderers/basic/line-chart/line-chart-renderer";
import { ScatterChartRenderer } from "./chart-renderers/basic/scatter-chart/scatter-chart-renderer";

// Dynamic import for better performance
const LazyChartWrapper = dynamic(
  () => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[300px] items-center justify-center">
        <div className="text-muted-foreground">Loading visualization...</div>
      </div>
    ),
  },
);

interface ExperimentVisualizationRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[] | null;
  showTitle?: boolean;
  showDescription?: boolean;
}

export default function ExperimentVisualizationRenderer({
  visualization,
  experimentId,
  data,
  showTitle = true,
  showDescription = true,
}: ExperimentVisualizationRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const renderChart = () => {
    // Common props for all chart renderers
    const commonProps = {
      visualization,
      experimentId,
      data: data ?? undefined,
    };

    switch (visualization.chartType) {
      case "line":
        return <LineChartRenderer {...commonProps} />;
      case "scatter":
        return <ScatterChartRenderer {...commonProps} />;
      default:
        return (
          <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
            <div className="text-center">
              <div className="mb-2 text-lg font-medium">{t("errors.unsupportedChartType")}</div>
              <div className="text-sm">
                {t("charts.types." + visualization.chartType, visualization.chartType)}{" "}
                {t("errors.chartTypeNotSupported")}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      {(showTitle || showDescription) && (
        <div className="mb-6">
          {showTitle && <h2 className="text-2xl font-bold">{visualization.name}</h2>}
          {showDescription && visualization.description && (
            <p className="text-muted-foreground mt-2">{visualization.description}</p>
          )}
        </div>
      )}
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <LazyChartWrapper>{renderChart()}</LazyChartWrapper>
      </div>
    </div>
  );
}
