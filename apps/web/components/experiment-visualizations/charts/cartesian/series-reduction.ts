import type { CartesianSeries } from "@repo/ui/components/charts/cartesian-chart";
import type { ErrorBarConfig } from "@repo/ui/components/charts/types";

import { m4Indices } from "../data/m4";

/** One bucket per pixel column on plots up to this many pixels wide. */
export const REDUCTION_BUCKETS = 2_000;

export type AxisRange = readonly [number, number];

/** Where a value sits on a line's x axis: epoch milliseconds for a date, NaN when it cannot. */
export function axisPosition(value: string | number | Date | null): number {
  if (typeof value === "number") {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string") {
    return Date.parse(value);
  }
  return Number.NaN;
}

/**
 * Plotly reports a date axis range as a zone-less "YYYY-MM-DD HH:MM:SS" string in the same frame
 * as the ISO timestamps the chart was given, so it is read as UTC like them.
 */
export function rangeEdgePosition(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return Number.NaN;
  }
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isZoneless = /^\d{4}-\d{2}-\d{2}[ T][\d:.]+$/.test(value);
  if (isDateOnly) {
    return Date.parse(`${value}T00:00:00Z`);
  }
  return isZoneless ? Date.parse(`${value.replace(" ", "T")}Z`) : Date.parse(value);
}

/**
 * Line and area series thinned to what the visible range can show, with every per-point array kept
 * in step. Their markers come from the chart's style, never per point, so only data arrays need
 * thinning. Stacked areas stay whole: they stack by index, so thinning each on its own would pair
 * the wrong points.
 */
export function reduceSeries(
  series: CartesianSeries[],
  positions: readonly number[][],
  rangeFor: (series: CartesianSeries) => AxisRange | undefined,
): { series: CartesianSeries[]; isReduced: boolean } {
  let isReduced = false;

  const reduced = series.map((one, index) => {
    const xs = positions[index] ?? [];
    const isLine = one.traceType === "line" || one.traceType === "area";
    const isReducible = isLine && !one.stackgroup && xs.length > 4 * REDUCTION_BUCKETS;
    if (!isReducible) {
      return one;
    }

    const range = rangeFor(one) ?? [xs[0], xs[xs.length - 1]];
    const ys = one.y.map((y) => (typeof y === "number" ? y : null));
    const picked = m4Indices(xs, ys, range, REDUCTION_BUCKETS);
    if (picked.length === xs.length) {
      return one;
    }

    isReduced = true;
    return pickPoints(one, picked);
  });

  return { series: reduced, isReduced };
}

function pickPoints(series: CartesianSeries, picked: number[]): CartesianSeries {
  const length = series.x.length;

  return {
    ...series,
    x: picked.map((i) => series.x[i]),
    y: picked.map((i) => series.y[i]),
    text: Array.isArray(series.text) ? pickAligned(series.text, picked, length) : series.text,
    customdata: series.customdata ? pickAligned(series.customdata, picked, length) : undefined,
    error_x: series.error_x ? pickErrorBar(series.error_x, picked, length) : undefined,
    error_y: series.error_y ? pickErrorBar(series.error_y, picked, length) : undefined,
  };
}

function pickErrorBar(bar: ErrorBarConfig, picked: number[], length: number): ErrorBarConfig {
  return bar.array ? { ...bar, array: pickAligned(bar.array, picked, length) } : bar;
}

/** Only a per-point array is thinned; one of another length is a setting, not data. */
function pickAligned<T>(values: T[], picked: number[], length: number): T[] {
  return values.length === length ? picked.map((i) => values[i]) : values;
}
