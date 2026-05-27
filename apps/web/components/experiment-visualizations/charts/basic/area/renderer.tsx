"use client";

import { useTranslation } from "@repo/i18n";

import { CartesianRenderer } from "../../cartesian/cartesian-renderer";
import { ChartConfigError } from "../../chart-frame";
import type { ChartRendererProps } from "../../types";

export function AreaRenderer(props: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  if (props.visualization.chartType !== "area") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  return <CartesianRenderer {...props} defaultTraceType="area" />;
}
