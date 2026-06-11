"use client";

import { useTranslation } from "@repo/i18n";

import { CartesianRenderer } from "../../cartesian/cartesian-renderer";
import { ChartConfigError } from "../../chart-frame";
import type { ChartRendererProps } from "../../types";

export function BubbleRenderer(props: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  if (props.visualization.chartType !== "bubble") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  return (
    <CartesianRenderer {...props} defaultTraceType="scatter" supportsContinuousColor supportsSize />
  );
}
