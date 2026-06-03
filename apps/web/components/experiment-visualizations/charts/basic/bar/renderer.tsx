"use client";

import { useTranslation } from "@repo/i18n";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { CartesianRenderer } from "../../cartesian/cartesian-renderer";
import { narrowChartConfig } from "../../chart-config";
import type { ChartFormConfig } from "../../chart-config";
import { ChartConfigError } from "../../chart-frame";
import type { ChartRendererProps } from "../../types";

export function BarRenderer(props: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  if (props.visualization.chartType !== "bar") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const chartConfig = narrowChartConfig(props.visualization);
  const orientation = chartConfig.orientation === "h" ? "h" : "v";

  // Mirror axis title/type swap in horizontal mode; form keeps X=categories.
  const swappedConfig: ChartFormConfig & PlotlyChartConfig =
    orientation === "h"
      ? {
          ...chartConfig,
          xAxisTitle: chartConfig.yAxisTitle,
          yAxisTitle: chartConfig.xAxisTitle,
          xAxisType: chartConfig.yAxisType,
          yAxisType: chartConfig.xAxisType,
        }
      : chartConfig;

  const swapped =
    orientation === "h"
      ? {
          ...props.visualization,
          config: { ...swappedConfig },
        }
      : props.visualization;

  return <CartesianRenderer {...props} visualization={swapped} defaultTraceType="bar" />;
}
