import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import type { PolarSeriesData } from "@repo/ui/components/charts/polar";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor, getDefaultSeriesColor } from "../../colors/palettes";
import { rowKeyForSource } from "../../data/aggregation";
import { coerceCell, toBucketKey } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";

interface YPick {
  column: string;
  rowKey: string;
}

interface RowPoint {
  theta: number | string;
  rs: number[];
}

/** Coerce one row to a (theta, rs[]) tuple. Returns null when theta is missing. */
function coerceRowPoint(
  row: Record<string, unknown>,
  xColumn: string,
  yPicks: YPick[],
): RowPoint | null {
  const theta = coerceCell(row[xColumn]);
  if (theta === null) {
    return null;
  }
  const rs = yPicks.map((p) => {
    const v = coerceCell(row[p.rowKey]);
    return typeof v === "number" ? v : NaN;
  });
  return { theta, rs };
}

// Sort by theta: numeric sorted numerically (Plotly draws in array order);
// categorical preserves insertion order.
function sortByTheta(
  thetaVals: (number | string)[],
  rVals: number[],
): { theta: (number | string)[]; r: number[] } {
  const allNumeric = thetaVals.every((v) => typeof v === "number");
  if (!allNumeric) {
    return { theta: thetaVals, r: rVals };
  }
  const order = thetaVals.map((_, i) => i).sort((a, b) => thetaVals[a] - thetaVals[b]);
  return {
    theta: order.map((i) => thetaVals[i]),
    r: order.map((i) => rVals[i]),
  };
}

/** Pure data transform for the polar chart: pulls (theta, r) pairs per Y series, optionally split per categorical color. */
export function transformPolarData(
  rows: Record<string, unknown>[],
  dataSources: ExperimentDataSourceConfig[],
  chartConfig: ChartFormConfig,
): PolarSeriesData[] {
  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const yEntries = dataSourcesByRole(dataSources, "y");
  const yPicks: YPick[] = yEntries
    .map((entry) => ({
      column: entry.source.columnName,
      rowKey: rowKeyForSource(entry.source, entry.index),
    }))
    .filter((p) => p.column.length > 0);

  if (!xColumn || yPicks.length === 0 || rows.length === 0) {
    return [];
  }

  const colorColumn = dataSourcesByRole(dataSources, "color")[0]?.source.columnName;
  const mode = chartConfig.polarMode ?? "markers";
  const lineWidth = chartConfig.polarLineWidth ?? 2;
  const markerSize = chartConfig.polarMarkerSize ?? 6;
  const fill = Boolean(chartConfig.polarFill);
  const isCategoricalColor = Boolean(colorColumn) && chartConfig.colorMode === "categorical";
  const wantsLines = mode.includes("lines");
  const wantsMarkers = mode.includes("markers");

  const buildTrace = (
    thetaVals: (number | string)[],
    rVals: number[],
    name: string,
    color: string,
  ): PolarSeriesData => {
    const sorted = sortByTheta(thetaVals, rVals);
    return {
      r: sorted.r,
      theta: sorted.theta,
      name,
      color,
      mode,
      ...(wantsLines ? { line: { color, width: lineWidth } } : {}),
      ...(wantsMarkers ? { marker: { color, size: markerSize } } : {}),
      fill: fill ? "toself" : "none",
      fillcolor: fill ? color : undefined,
    };
  };

  if (isCategoricalColor && colorColumn) {
    return buildCategoricalTraces({ rows, xColumn, yPicks, colorColumn, chartConfig, buildTrace });
  }

  // Non-categorical path: one trace per Y series, with all rows.
  const theta: (number | string)[] = [];
  const rByY: number[][] = yPicks.map(() => []);
  for (const row of rows) {
    const point = coerceRowPoint(row, xColumn, yPicks);
    if (!point) {
      continue;
    }
    theta.push(point.theta);
    point.rs.forEach((r, i) => rByY[i].push(r));
  }
  return yPicks.map((p, i) => buildTrace(theta, rByY[i], p.column, getDefaultSeriesColor(i)));
}

interface CategoryBucket {
  theta: (number | string)[];
  rByY: number[][];
}

interface CategoricalTracesParams {
  rows: Record<string, unknown>[];
  xColumn: string;
  yPicks: YPick[];
  colorColumn: string;
  chartConfig: ChartFormConfig;
  buildTrace: (
    thetaVals: (number | string)[],
    rVals: number[],
    name: string,
    color: string,
  ) => PolarSeriesData;
}

// Bucket rows by category then by Y series. The legend pattern
// "<y-column> · <category>" reads cleanly when multiple Y columns and
// multiple categories produce a grid of traces.
function buildCategoricalTraces({
  rows,
  xColumn,
  yPicks,
  colorColumn,
  chartConfig,
  buildTrace,
}: CategoricalTracesParams): PolarSeriesData[] {
  const categoryOrder: string[] = [];
  const buckets = new Map<string, CategoryBucket>();
  for (const row of rows) {
    const point = coerceRowPoint(row, xColumn, yPicks);
    if (!point) {
      continue;
    }
    const cat = toBucketKey(row[colorColumn]);
    let bucket = buckets.get(cat);
    if (!bucket) {
      categoryOrder.push(cat);
      bucket = { theta: [], rByY: yPicks.map(() => []) };
      buckets.set(cat, bucket);
    }
    bucket.theta.push(point.theta);
    point.rs.forEach((r, i) => bucket.rByY[i].push(r));
  }

  const traces: PolarSeriesData[] = [];
  categoryOrder.forEach((cat, catIdx) => {
    const bucket = buckets.get(cat);
    if (!bucket) {
      return;
    }
    const color = getCategoryColor(catIdx, chartConfig.colorMap, cat);
    yPicks.forEach((p, yIdx) => {
      const name = yPicks.length > 1 ? `${p.column} · ${cat}` : cat;
      traces.push(buildTrace(bucket.theta, bucket.rByY[yIdx], name, color));
    });
  });
  return traces;
}
