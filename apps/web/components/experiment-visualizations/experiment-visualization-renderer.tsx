"use client";

import dynamic from "next/dynamic";
import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

import { LineChartRenderer } from "./chart-renderers/basic/line-chart/line-chart-renderer";
import { ScatterChartRenderer } from "./chart-renderers/basic/scatter-chart/scatter-chart-renderer";

// Dynamic import for better performance
const LazyChartWrapper = dynamic(
  () => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading visualization...</div>
      </div>
    ),
  },
);

interface ExperimentVisualizationRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[] | null;
  height?: number;
  showTitle?: boolean;
  showDescription?: boolean;
  isPreview?: boolean;
}

export default function ExperimentVisualizationRenderer({
  visualization,
  experimentId,
  data,
  height = 450,
  showTitle = true,
  showDescription = true,
  isPreview = false,
}: ExperimentVisualizationRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const renderChart = () => {
    // Common props for all chart renderers
    const commonProps = {
      visualization,
      experimentId,
      data: data ?? undefined, // Convert null to undefined
      height,
      isPreview,
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
                {t("chartTypes." + visualization.chartType, visualization.chartType)}{" "}
                {t("errors.chartTypeNotSupported")}
              </div>
            </div>
          </div>
        );
    }
  };

  if (isPreview) {
    return (
      <div className="w-full" style={{ height: `${height}px` }}>
        <LazyChartWrapper>{renderChart()}</LazyChartWrapper>
      </div>
    );
  }

  return (
    <Card className="w-full">
      {(showTitle || showDescription) && (
        <CardHeader>
          {showTitle && <CardTitle>{visualization.name}</CardTitle>}
          {showDescription && visualization.description && (
            <p className="text-muted-foreground text-sm">{visualization.description}</p>
          )}
        </CardHeader>
      )}
      <CardContent>
        <div className="w-full pt-6" style={{ height: `${height}px` }}>
          <LazyChartWrapper>{renderChart()}</LazyChartWrapper>
        </div>
      </CardContent>
    </Card>
  );
}
