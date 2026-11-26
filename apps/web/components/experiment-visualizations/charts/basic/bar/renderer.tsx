"use client";

import { useTranslation } from "@repo/i18n";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { CartesianRenderer } from "../../cartesian/cartesian-renderer";
import { canUseHorizontalBars } from "../../cartesian/series-axis";
import { narrowChartConfig } from "../../chart-config";
import type { ChartFormConfig } from "../../chart-config";
import { ChartConfigError } from "../../chart-frame";
import { dataSourcesByRole } from "../../data/data-sources";
import type { ChartRendererProps } from "../../types";

export function BarRenderer(props: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  if (props.visualization.chartType !== "bar") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const chartConfig = narrowChartConfig(props.visualization);
  const ySources = dataSourcesByRole(props.visualization.dataConfig.dataSources, "y");
  const horizontal = chartConfig.orientation === "h" && canUseHorizontalBars(ySources, "bar");

  // Mirror axis title/type swap in horizontal mode; form keeps X=categories.
  const swappedConfig: ChartFormConfig & PlotlyChartConfig = horizontal
    ? {
        ...chartConfig,
        xAxisTitle: chartConfig.yAxisTitle,
        yAxisTitle: chartConfig.xAxisTitle,
        xAxisType: chartConfig.yAxisType,
        yAxisType: chartConfig.xAxisType,
      }
    : chartConfig;

  const swapped = horizontal
    ? {
        ...props.visualization,
        config: { ...swappedConfig },
      }
    : props.visualization;

  return <CartesianRenderer {...props} visualization={swapped} defaultTraceType="bar" />;
}
