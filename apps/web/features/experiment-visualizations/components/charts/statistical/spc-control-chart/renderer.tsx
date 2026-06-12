"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { SPCChart } from "@repo/ui/components/charts/spc-chart";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { coerceCell } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";

export function SPCRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const xColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "x")[0]?.source
    .columnName;
  const yColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "y")[0]?.source
    .columnName;

  // Order matters: SPC reads as a process *walk* over X, so fetched
  // rows need to be ordered by the chosen X column.
  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn || undefined,
  });

  const chartConfig = narrowChartConfig(visualization);

  const computed = useMemo(() => {
    if (visualization.chartType !== "spc-control-chart") {
      return null;
    }
    if (!yColumn) {
      return null;
    }

    // X is optional; without a column the renderer synthesises `0..n-1`
    // (canonical Individuals-chart layout when no time column exists).
    // Inlined here since SPC has its own renderer pipeline.
    const useIndexForX = !xColumn;

    const xs: (string | number)[] = [];
    const ys: number[] = [];
    rows.forEach((row, i) => {
      const yCell = coerceCell(row[yColumn]);
      // Y is restricted to numeric per the role contract; drop rows
      // where Y fails to coerce to keep mean/sigma finite.
      if (typeof yCell !== "number") {
        return;
      }
      if (useIndexForX) {
        xs.push(i);
      } else {
        const xCell = coerceCell(row[xColumn]);
        if (xCell === null) {
          return;
        }
        xs.push(xCell);
      }
      ys.push(yCell);
    });

    if (ys.length < 2) {
      // Need >= 2 observations for sample std (n-1 denominator).
      return { xs, ys, cl: 0, ucl: 0, lcl: 0, outOfControlIndices: [] as number[] };
    }

    // Sample mean / std with Bessel's correction (n-1). Population
    // sigma would underestimate for small samples and produce
    // unrealistically tight limits.
    const n = ys.length;
    const mean = ys.reduce((acc, v) => acc + v, 0) / n;
    const variance = ys.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / Math.max(n - 1, 1);
    const std = Math.sqrt(variance);

    const k = chartConfig.spcSigmaMultiplier ?? 3;
    const ucl = mean + k * std;
    const lcl = mean - k * std;
    const warningUpper = chartConfig.spcShowWarningLimits ? mean + 2 * std : undefined;
    const warningLower = chartConfig.spcShowWarningLimits ? mean - 2 * std : undefined;

    // Western Electric rule 1: any single point outside +/-k*sigma.
    // Consecutive-points rules can come later; single-point is the most
    // legible signal anyway.
    const highlight = chartConfig.spcHighlightOutliers !== false;
    const outOfControlIndices: number[] = [];
    if (highlight) {
      for (let i = 0; i < ys.length; i++) {
        if (ys[i] > ucl || ys[i] < lcl) {
          outOfControlIndices.push(i);
        }
      }
    }

    return {
      xs,
      ys,
      cl: mean,
      ucl,
      lcl,
      warningUpper,
      warningLower,
      outOfControlIndices,
    };
  }, [
    rows,
    xColumn,
    yColumn,
    chartConfig.spcSigmaMultiplier,
    chartConfig.spcShowWarningLimits,
    chartConfig.spcHighlightOutliers,
    visualization.chartType,
  ]);

  if (visualization.chartType !== "spc-control-chart") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const seriesColor = Array.isArray(chartConfig.color) ? chartConfig.color[0] : chartConfig.color;

  const hasRows = (computed?.ys.length ?? 0) > 0 && Boolean(yColumn);

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <SPCChart
          x={computed?.xs ?? []}
          y={computed?.ys ?? []}
          cl={computed?.cl ?? 0}
          ucl={computed?.ucl ?? 0}
          lcl={computed?.lcl ?? 0}
          warningUpper={computed?.warningUpper}
          warningLower={computed?.warningLower}
          outOfControlIndices={computed?.outOfControlIndices ?? []}
          config={chartConfig}
          mode={chartConfig.spcMode ?? "lines+markers"}
          markerSize={chartConfig.spcMarkerSize ?? 5}
          markerOpacity={chartConfig.spcMarkerOpacity ?? 1}
          seriesColor={seriesColor}
        />
      </div>
    </ChartFrame>
  );
}
