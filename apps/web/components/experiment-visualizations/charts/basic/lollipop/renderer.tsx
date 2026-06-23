"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { LollipopChart } from "@repo/ui/components/charts/dot-plot";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { rowKeyForSource } from "../../data/aggregation";
import { toBucketKey } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";

export function LollipopRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const xColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "x")[0]?.source
    .columnName;
  const yEntry = dataSourcesByRole(visualization.dataConfig.dataSources, "y")[0];
  const yColumn = yEntry?.source.columnName;
  // rowKeyForSource projects per-series aggregates under an aliased
  // column; reading via the helper keeps raw + aggregated paths uniform.
  const yRowKey = yEntry ? rowKeyForSource(yEntry.source, yEntry.index) : undefined;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn,
  });

  const chartConfig = narrowChartConfig(visualization);
  const orientation = chartConfig.orientation === "h" ? "h" : "v";

  // Lollipop is strictly single-series; the wrapper takes scalar
  // categories[]/values[] and synthesises N stems + 1 dot internally.
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
    // Plotly tolerates NaN as missing data on numeric axes, so coercing a
    // non-numeric Y cell to NaN is preferable to silently dropping the row
    // (which would misalign the categories array). The role contract
    // restricts Y to numeric kinds, so this case is rare in practice.
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

  // Swap axis titles/types when horizontal so the form's "X axis" label
  // (the user's mental model: X = categories) follows the category axis to
  // the left side. Same convention used by bar/dot-plot. The LollipopChart
  // wrapper falls back to placeholder titles ("Category" / "Value") when
  // empty, which fills in nicely if the user hasn't named anything.
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
