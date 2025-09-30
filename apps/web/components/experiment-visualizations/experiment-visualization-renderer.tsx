"use client";

import dynamic from "next/dynamic";
import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

import { AreaChartRenderer } from "./chart-renderers/area-chart-renderer";
import { BarChartRenderer } from "./chart-renderers/bar-chart-renderer";
import { BoxPlotRenderer } from "./chart-renderers/box-plot-renderer";
import { BubbleChartRenderer } from "./chart-renderers/bubble-chart-renderer";
import { ContourChartRenderer } from "./chart-renderers/contour-chart-renderer";
import { DotPlotRenderer } from "./chart-renderers/dot-plot-renderer";
import { HeatmapChartRenderer } from "./chart-renderers/heatmap-chart-renderer";
import { LineChartRenderer } from "./chart-renderers/line-chart-renderer";
import { LogPlotChartRenderer } from "./chart-renderers/log-plot-chart-renderer";
import { LollipopChartRenderer } from "./chart-renderers/lollipop-chart-renderer";
import { ParallelCoordinatesChartRenderer } from "./chart-renderers/parallel-coordinates-chart-renderer";
import { PieChartRenderer } from "./chart-renderers/pie-chart-renderer";
import { RadarChartRenderer } from "./chart-renderers/radar-chart-renderer";
import { ScatterChartRenderer } from "./chart-renderers/scatter-chart-renderer";
import { TernaryChartRenderer } from "./chart-renderers/ternary-chart-renderer";

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
  height = 400,
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
      case "bar":
        return <BarChartRenderer {...commonProps} />;
      case "pie":
        return <PieChartRenderer {...commonProps} />;
      case "area":
        return <AreaChartRenderer {...commonProps} />;
      case "scatter":
        return <ScatterChartRenderer {...commonProps} />;
      case "dot-plot":
        return <DotPlotRenderer {...commonProps} />;
      case "bubble":
        return <BubbleChartRenderer {...commonProps} />;
      case "lollipop":
        return <LollipopChartRenderer {...commonProps} />;
      case "box-plot":
        return <BoxPlotRenderer {...commonProps} />;
      case "heatmap":
        return <HeatmapChartRenderer {...commonProps} />;
      case "contour":
        return <ContourChartRenderer {...commonProps} />;
      case "ternary":
        return <TernaryChartRenderer {...commonProps} />;
      case "log-plot":
        return <LogPlotChartRenderer {...commonProps} />;
      case "parallel-coordinates":
        return <ParallelCoordinatesChartRenderer {...commonProps} />;
      case "radar":
        return <RadarChartRenderer {...commonProps} />;
      default:
        return (
          <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
            <div className="text-center">
              <div className="mb-2 text-lg font-medium">{t("errors.unsupportedChartType")}</div>
              <div className="text-sm">
                {t("chartTypes." + visualization.config.chartType, visualization.config.chartType)}{" "}
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
        <div className="w-full" style={{ height: `${height}px` }}>
          <LazyChartWrapper>{renderChart()}</LazyChartWrapper>
        </div>
      </CardContent>
    </Card>
  );
}
