import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";
import type { RidgeSeriesData } from "@repo/ui/components/charts/ridge-plot";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor } from "../../colors/palettes";
import { coerceCell, toBucketKey } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";
import { computeKDE } from "../../data/kde";

// Each lane gets one unit of vertical space; the curve is scaled to fit
// `1 + ridgeOverlap` units of that allowance so user-controlled overlap
// intrudes into the lane above. Constant lane unit (1) keeps the math
// clear and means tickvals are just integer indices.
const LANE_UNIT = 1;

export interface RidgePlotTransformResult {
  series: RidgeSeriesData[];
  ticks: { value: number; label: string }[];
}

interface RidgeCurve {
  key: string;
  label: string;
  values: number[];
  xs: number[];
  pdf: number[];
  mean: number;
  median: number;
  count: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Pure data transform for the ridge-plot chart: per-category KDE on a shared X range, peaks normalised to a fixed lane allowance. */
export function transformRidgePlotData(
  rows: Record<string, unknown>[],
  dataSources: ExperimentDataSourceConfig[],
  chartConfig: ChartFormConfig,
): RidgePlotTransformResult {
  const yColumn = dataSourcesByRole(dataSources, "y")[0]?.source.columnName;
  const colorColumn = dataSourcesByRole(dataSources, "color")[0]?.source.columnName;
  if (!yColumn || !colorColumn || rows.length === 0) {
    return { series: [], ticks: [] };
  }

  const overlap = clamp(chartConfig.ridgeOverlap ?? 0.5, 0, 0.95);
  const sortOrder = chartConfig.ridgeSortOrder ?? "alphabetical";

  const valuesByCategory = bucketNumericValuesByCategory(rows, yColumn, colorColumn);
  if (valuesByCategory.size === 0) {
    return { series: [], ticks: [] };
  }

  // Shared X range across lanes so peaks line up vertically; min/max of
  // the global pool padded by ~Silverman bandwidth.
  const sharedRange = computeSharedXRange(valuesByCategory);

  const curves = buildRidgeCurves(valuesByCategory, sharedRange);
  if (curves.length === 0) {
    return { series: [], ticks: [] };
  }

  // Vertical reading order is bottom-to-top (lane 0 = bottom; ggridges convention).
  sortCurvesInPlace(curves, sortOrder);

  // Normalize each curve's peak to fit the lane allowance. Equal peak
  // heights = "shape comparison only," which is what the ridge-plot is for.
  const peakAllowance = LANE_UNIT * (1 + overlap);
  const series: RidgeSeriesData[] = curves.map((curve, laneIndex) => {
    let peak = 1e-9;
    for (const v of curve.pdf) {
      if (v > peak) {
        peak = v;
      }
    }
    const scale = peakAllowance / peak;
    const laneBaseY = laneIndex * LANE_UNIT;
    const ys = curve.pdf.map((d) => laneBaseY + d * scale);
    const color = getCategoryColor(laneIndex, chartConfig.colorMap, curve.key);
    return {
      name: curve.label,
      xs: curve.xs,
      ys,
      laneBaseY,
      color,
    };
  });

  const ticks = curves.map((c, i) => ({ value: i * LANE_UNIT, label: c.label }));
  return { series, ticks };
}

// Bucket numeric Y values by category; skip non-numeric cells so KDE
// doesn't produce NaN peaks (which Plotly silently drops).
function bucketNumericValuesByCategory(
  rows: Record<string, unknown>[],
  yColumn: string,
  colorColumn: string,
): Map<string, number[]> {
  const valuesByCategory = new Map<string, number[]>();
  for (const row of rows) {
    const yCell = coerceCell(row[yColumn]);
    if (typeof yCell !== "number") {
      continue;
    }
    const key = toBucketKey(row[colorColumn]);
    const list = valuesByCategory.get(key);
    if (list) {
      list.push(yCell);
    } else {
      valuesByCategory.set(key, [yCell]);
    }
  }
  return valuesByCategory;
}

// Welford-style single-pass min/max + std over the pooled values; std
// pads the range so KDE tails aren't clipped at lane edges.
function computeSharedXRange(valuesByCategory: Map<string, number[]>): [number, number] {
  let n = 0;
  let runningMean = 0;
  let m2 = 0;
  let globalMin = Number.POSITIVE_INFINITY;
  let globalMax = Number.NEGATIVE_INFINITY;
  for (const arr of valuesByCategory.values()) {
    for (const v of arr) {
      if (v < globalMin) {
        globalMin = v;
      }
      if (v > globalMax) {
        globalMax = v;
      }
      n++;
      const delta = v - runningMean;
      runningMean += delta / n;
      m2 += delta * (v - runningMean);
    }
  }
  const globalStd = n > 0 ? Math.sqrt(m2 / n) : 0;
  const padding = Math.max(globalStd * 0.5, 1e-9);
  return [globalMin - padding, globalMax + padding];
}

function buildRidgeCurves(
  valuesByCategory: Map<string, number[]>,
  sharedRange: [number, number],
): RidgeCurve[] {
  const curves: RidgeCurve[] = [];
  for (const [key, vals] of valuesByCategory.entries()) {
    if (vals.length < 2) {
      continue;
    }
    const { xs, ys } = computeKDE(vals, false, sharedRange);
    const sorted = [...vals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    curves.push({
      key,
      label: key === "" ? "(none)" : key,
      values: vals,
      xs,
      pdf: ys,
      mean,
      median,
      count: vals.length,
    });
  }
  return curves;
}

function sortCurvesInPlace(curves: RidgeCurve[], sortOrder: ChartFormConfig["ridgeSortOrder"]) {
  curves.sort((a, b) => {
    switch (sortOrder) {
      case "median":
        return a.median - b.median;
      case "mean":
        return a.mean - b.mean;
      // Descending: largest sample sizes at the bottom (most visual weight).
      case "count":
        return b.count - a.count;
      case "alphabetical":
      default:
        return a.label.localeCompare(b.label);
    }
  });
}
