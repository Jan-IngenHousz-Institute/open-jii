"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { DensityPlot2D } from "@repo/ui/components/charts/density-plot-2d";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { resolveColorscale } from "../../colors/colorscales";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { positiveOrAuto } from "../histogram-2d/transform";
import { transformDensityPlot2DData } from "./transform";

export function DensityPlot2DRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Order doesn't matter for either trace; scatter renders points
  // regardless of order, contour bins by frequency.
  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData);
  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;

  const pairs = useMemo(() => {
    if (visualization.chartType !== "density-plot-2d") {
      return null;
    }
    return transformDensityPlot2DData(rows, dataSources);
  }, [rows, dataSources, visualization.chartType]);

  if (visualization.chartType !== "density-plot-2d") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const seriesColor = Array.isArray(chartConfig.color) ? chartConfig.color[0] : chartConfig.color;
  const showMarkers = chartConfig.density2dShowMarkers !== false;
  const markerSize = chartConfig.density2dMarkerSize ?? 4;
  const markerOpacity = chartConfig.density2dMarkerOpacity ?? 0.4;
  const contourFill = Boolean(chartConfig.density2dContourFill);
  const showColorbar = chartConfig.density2dShowColorbar !== false;

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={(pairs?.x.length ?? 0) > 0 && (pairs?.hasColumns ?? false)}
    >
      <div className="flex h-full w-full flex-col">
        <DensityPlot2D
          x={pairs?.x ?? []}
          y={pairs?.y ?? []}
          config={chartConfig}
          showMarkers={showMarkers}
          markerSize={markerSize}
          markerOpacity={markerOpacity}
          markerColor={seriesColor}
          // Plotly accepts `undefined` for nbins (auto-pick); the form
          // persists 0 as "auto" so the slider's floor reads usefully.
          nbinsx={positiveOrAuto(chartConfig.hist2dNbinsX)}
          nbinsy={positiveOrAuto(chartConfig.hist2dNbinsY)}
          colorscale={resolveColorscale(chartConfig.hist2dColorscale ?? "Viridis")}
          reverseScale={Boolean(chartConfig.hist2dReverseScale)}
          contourFill={contourFill}
          showColorbar={showColorbar}
          colorbarTitle={
            chartConfig.hist2dColorbarTitle && chartConfig.hist2dColorbarTitle.length > 0
              ? chartConfig.hist2dColorbarTitle
              : undefined
          }
        />
      </div>
    </ChartFrame>
  );
}
