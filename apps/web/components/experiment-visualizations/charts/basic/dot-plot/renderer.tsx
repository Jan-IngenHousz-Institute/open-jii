"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import type { DotSeriesData } from "@repo/ui/components/charts/dot-plot";
import { DotPlot } from "@repo/ui/components/charts/dot-plot";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { narrowChartConfig } from "../../chart-config";
import type { ChartFormConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { getCategoryColor } from "../../colors/palettes";
import { rowKeyForSource } from "../../data/aggregation";
import { coerceCell, toBucketKey } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";

function pairedCells(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): {
  x: (string | number)[];
  y: (string | number)[];
  rows: Record<string, unknown>[];
} {
  const x: (string | number)[] = [];
  const y: (string | number)[] = [];
  const keptRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const xv = coerceCell(row[xKey]);
    const yv = coerceCell(row[yKey]);
    if (xv === null || yv === null) {
      continue;
    }
    x.push(xv);
    y.push(yv);
    keptRows.push(row);
  }
  return { x, y, rows: keptRows };
}

export function DotPlotRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const xColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "x")[0]?.source
    .columnName;
  const yEntries = useMemo(
    () => dataSourcesByRole(visualization.dataConfig.dataSources, "y"),
    [visualization.dataConfig.dataSources],
  );
  const colorColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "color")[0]?.source
    .columnName;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    orderBy: xColumn,
  });

  const chartConfig = narrowChartConfig(visualization);
  const orientation = chartConfig.orientation === "h" ? "h" : "v";

  const chartSeries = useMemo<DotSeriesData[]>(() => {
    if (visualization.chartType !== "dot-plot") {
      return [];
    }
    if (yEntries.length === 0 || !xColumn) {
      return [];
    }

    // Wrapper takes a scalar symbol; drop array values (panel only edits scalars).
    const symbol =
      typeof chartConfig.marker?.symbol === "string" ? chartConfig.marker.symbol : undefined;
    const colorMap = chartConfig.colorMap;

    // No Group by: one trace per Y series.
    if (!colorColumn) {
      return yEntries.map(({ source, index: dsIndex }, index) => {
        const yRowKey = rowKeyForSource(source, dsIndex);
        const { x, y, rows: pairedRows } = pairedCells(rows, xColumn, yRowKey);
        const seriesColor = Array.isArray(chartConfig.color)
          ? chartConfig.color[index]
          : chartConfig.color;
        return {
          x,
          y,
          name: source.alias ?? source.columnName,
          color: seriesColor,
          orientation,
          marker: {
            size: chartConfig.marker?.size,
            symbol,
            color: seriesColor,
            opacity: chartConfig.marker?.opacity,
          },
          ...buildErrorBars(pairedRows, source.errorColumn, orientation, chartConfig, seriesColor),
        };
      });
    }

    // Group by: one trace per (Y series x color category).
    const categoryValues: (string | number | null)[] = [];
    const rowsByCategory = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const raw = row[colorColumn];
      const key = toBucketKey(raw);
      let bucket = rowsByCategory.get(key);
      if (!bucket) {
        bucket = [];
        rowsByCategory.set(key, bucket);
        let labelValue: string | number | null;
        if (typeof raw === "string" || typeof raw === "number") {
          labelValue = raw;
        } else if (raw == null) {
          labelValue = null;
        } else {
          // toBucketKey already serialized the row into `key`; reuse it
          // rather than calling String() on an unknown value.
          labelValue = key;
        }
        categoryValues.push(labelValue);
      }
      bucket.push(row);
    }

    return yEntries.flatMap(({ source, index: dsIndex }, yIndex) => {
      const baseName = source.alias ?? source.columnName;
      const yRowKey = rowKeyForSource(source, dsIndex);
      return categoryValues.map((categoryValue, catIndex) => {
        const key = categoryValue == null ? "" : String(categoryValue);
        const groupRows = rowsByCategory.get(key) ?? [];
        const categoryLabel = categoryValue == null ? "(none)" : String(categoryValue);
        const seriesColor = getCategoryColor(
          catIndex + yIndex * categoryValues.length,
          colorMap,
          key,
          baseName,
        );
        const { x, y, rows: pairedRows } = pairedCells(groupRows, xColumn, yRowKey);
        return {
          x,
          y,
          name: yEntries.length === 1 ? categoryLabel : `${baseName} - ${categoryLabel}`,
          color: seriesColor,
          orientation,
          marker: {
            size: chartConfig.marker?.size,
            symbol,
            color: seriesColor,
            opacity: chartConfig.marker?.opacity,
          },
          ...buildErrorBars(pairedRows, source.errorColumn, orientation, chartConfig, seriesColor),
        };
      });
    });
  }, [rows, xColumn, yEntries, colorColumn, orientation, chartConfig, visualization.chartType]);

  if (visualization.chartType !== "dot-plot") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  // Mirror axis title/type swap in horizontal mode (see bar renderer).
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

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={rows.length > 0}
    >
      <div className="flex h-full w-full flex-col">
        <DotPlot data={chartSeries} config={effectiveConfig} orientation={orientation} />
      </div>
    </ChartFrame>
  );
}

function buildErrorBars(
  rows: Record<string, unknown>[],
  errorColumn: string | undefined,
  orientation: "v" | "h",
  chartConfig: ChartFormConfig,
  color: string | undefined,
): Partial<Pick<DotSeriesData, "error_x" | "error_y">> {
  if (!errorColumn) {
    return {};
  }
  const array = rows.map((row) => {
    const v = row[errorColumn];
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  });
  // DotSeriesData's error_x/error_y type omits color/thickness/width, but
  // Plotly accepts them at runtime, hence the cast.
  const block = {
    type: "data" as const,
    array,
    visible: true,
    thickness: chartConfig.errorBarThickness ?? 1.5,
    width: chartConfig.errorBarCapWidth ?? 4,
    color,
  } as DotSeriesData["error_x"];
  return orientation === "h" ? { error_x: block } : { error_y: block };
}
