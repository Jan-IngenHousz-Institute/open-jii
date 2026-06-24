"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { LollipopChart } from "@repo/ui/components/charts/dot-plot";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { rowKeyForSource } from "../../data/aggregation";
import { toBucketKey } from "../../data/cell-coercion";
import { firstDataSourceByRole } from "../../data/data-sources";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";

export function LollipopRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const xColumn = firstDataSourceByRole(visualization.dataConfig.dataSources, "x")?.source
    .columnName;
  const yEntry = firstDataSourceByRole(visualization.dataConfig.dataSources, "y");
  const yColumn = yEntry?.source.columnName;
  const yRowKey = yEntry ? rowKeyForSource(yEntry.source, yEntry.index) : undefined;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn,
  });

  const chartConfig = narrowChartConfig(visualization);
  const orientation = chartConfig.orientation === "h" ? "h" : "v";

  // Single-series; the wrapper takes scalar arrays and emits stems + dots.
  const categories = useMemo<string[]>(() => {
    if (!xColumn) {
      return [];
    }
    return rows.map((row) => toBucketKey(row[xColumn]));
  }, [rows, xColumn]);

  const values = useMemo<number[]>(() => {
    if (!yRowKey) {
      return [];
    }
    // Coerce non-numeric to NaN (Plotly treats it as a gap); dropping the row
    // would misalign categories[].
    return rows.map((row) => Number(row[yRowKey]));
  }, [rows, yRowKey]);

  const errors = useMemo<number[] | undefined>(() => {
    const errorColumn = yEntry?.source.errorColumn;
    if (!errorColumn) {
      return undefined;
    }
    return rows.map((row) => {
      const v = row[errorColumn];
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    });
  }, [rows, yEntry?.source.errorColumn]);

  const seriesColor = Array.isArray(chartConfig.color) ? chartConfig.color[0] : chartConfig.color;
  const dotSize = typeof chartConfig.marker?.size === "number" ? chartConfig.marker.size : 12;

  if (visualization.chartType !== "lollipop") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  // Swap axis title/type when horizontal so the form's "X axis" still maps
  // to the category axis (same convention as bar / dot-plot).
  const effectiveConfig: PlotlyChartConfig =
    orientation === "h"
      ? {
          ...chartConfig,
          xAxisTitle: chartConfig.yAxisTitle,
          yAxisTitle: chartConfig.xAxisTitle,
          xAxisType: chartConfig.yAxisType,
          yAxisType: chartConfig.xAxisType,
        }
      : chartConfig;

  const hasRows = rows.length > 0 && Boolean(xColumn) && Boolean(yColumn) && Boolean(yEntry);

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <LollipopChart
          categories={categories}
          values={values}
          name={yEntry?.source.alias ?? yColumn}
          color={seriesColor}
          orientation={orientation}
          stemWidth={chartConfig.stemWidth}
          dotSize={dotSize}
          errors={errors}
          errorBarThickness={chartConfig.errorBarThickness}
          errorBarCapWidth={chartConfig.errorBarCapWidth}
          config={effectiveConfig}
        />
      </div>
    </ChartFrame>
  );
}
