import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";
import type { TernarySeriesData } from "@repo/ui/components/charts/ternary";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor, getDefaultSeriesColor } from "../../colors/palettes";
import { coerceCell, toBucketKey } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";

export interface TernaryTransformResult {
  series: TernarySeriesData[];
  aColumn: string | undefined;
  bColumn: string | undefined;
  cColumn: string | undefined;
}

interface TernaryPoint {
  a: number;
  b: number;
  c: number;
  cat?: string;
}

/** Pure data transform for the ternary chart: pulls (a, b, c) tuples and optionally splits into one trace per categorical-color value. */
export function transformTernaryData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
  chartConfig: ChartFormConfig,
): TernaryTransformResult {
  const aColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const bColumn = dataSourcesByRole(dataSources, "y")[0]?.source.columnName;
  const cColumn = dataSourcesByRole(dataSources, "z")[0]?.source.columnName;
  const colorColumn = dataSourcesByRole(dataSources, "color")[0]?.source.columnName;

  if (!aColumn || !bColumn || !cColumn || rows.length === 0) {
    return { series: [], aColumn, bColumn, cColumn };
  }

  const configuredSum = chartConfig.ternarySum;
  const sum =
    typeof configuredSum === "number" && Number.isFinite(configuredSum) && configuredSum > 0
      ? configuredSum
      : 100;
  const mode = chartConfig.ternaryMode ?? "markers";
  const markerSize = chartConfig.ternaryMarkerSize ?? 7;
  const lineWidth = chartConfig.ternaryLineWidth ?? 2;
  const wantsLines = mode.includes("lines");
  const wantsMarkers = mode.includes("markers");
  const isCategoricalColor = Boolean(colorColumn) && chartConfig.colorMode === "categorical";

  const points: TernaryPoint[] = [];
  for (const row of rows) {
    const a = coerceCell(row[aColumn]);
    const b = coerceCell(row[bColumn]);
    const c = coerceCell(row[cColumn]);
    if (
      typeof a !== "number" ||
      typeof b !== "number" ||
      typeof c !== "number" ||
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      !Number.isFinite(c) ||
      a < 0 ||
      b < 0 ||
      c < 0
    ) {
      continue;
    }
    if (a + b + c <= 0) {
      continue;
    }
    const cat = colorColumn && isCategoricalColor ? toBucketKey(row[colorColumn]) : undefined;
    points.push({ a, b, c, cat });
  }
  if (points.length === 0) {
    return { series: [], aColumn, bColumn, cColumn };
  }

  const buildTrace = (pts: TernaryPoint[], name: string, color: string): TernarySeriesData => ({
    a: pts.map((p) => p.a),
    b: pts.map((p) => p.b),
    c: pts.map((p) => p.c),
    name,
    color,
    mode,
    sum,
    ...(wantsLines ? { line: { color, width: lineWidth } } : {}),
    ...(wantsMarkers ? { marker: { color, size: markerSize } } : {}),
  });

  if (isCategoricalColor && colorColumn) {
    // One trace per category (same shape as polar / scatter). Categories
    // appear in first-seen order so the legend mirrors data order.
    const categoryOrder: string[] = [];
    const buckets = new Map<string, TernaryPoint[]>();
    for (const p of points) {
      const key = p.cat ?? "";
      let bucket = buckets.get(key);
      if (!bucket) {
        categoryOrder.push(key);
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push(p);
    }
    return {
      series: categoryOrder.map((cat, idx) =>
        buildTrace(buckets.get(cat) ?? [], cat, getCategoryColor(idx, chartConfig.colorMap, cat)),
      ),
      aColumn,
      bColumn,
      cColumn,
    };
  }

  return {
    series: [buildTrace(points, aColumn, getDefaultSeriesColor(0))],
    aColumn,
    bColumn,
    cColumn,
  };
}
