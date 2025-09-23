"use client";

import dynamic from "next/dynamic";
import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

import { AreaChartRenderer } from "./chart-renderers/area-chart-renderer";
import { BarChartRenderer } from "./chart-renderers/bar-chart-renderer";
import { LineChartRenderer } from "./chart-renderers/line-chart-renderer";
import { PieChartRenderer } from "./chart-renderers/pie-chart-renderer";
import { ScatterChartRenderer } from "./chart-renderers/scatter-chart-renderer";

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
        // TODO: Implement dot-plot chart type
        return (
          <div className="bg-muted/20 flex h-full items-center justify-center rounded-lg border-2 border-dashed">
            <div className="text-center">
              <div className="text-muted-foreground mb-2 text-lg font-medium">Dot Plot Chart</div>
              <div className="text-muted-foreground text-sm">
                Coming Soon - dot-plot charts are not yet implemented
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
            <div className="text-center">
              <div className="mb-2 text-lg font-medium">Unsupported Chart Type</div>
              <div className="text-sm">Chart type "{visualization.chartType}" is not supported</div>
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
