import type { CartesianSeries } from "@repo/ui/components/charts/cartesian-chart";
import type { ErrorBarConfig } from "@repo/ui/components/charts/types";

import { countInRange, m4Indices } from "../data/m4";

/** Buckets a chart's lines share: one per pixel column on plots up to this many pixels wide. */
export const REDUCTION_BUCKETS = 2_000;

/** Fewest buckets one line gets, however many lines share the chart. */
const MIN_BUCKETS_PER_LINE = 200;

/**
 * Most points a chart's lines draw with markers. Past it the markers overlap into a smear, and on
 * SVG each one is its own element, so the lines are drawn alone.
 */
export const MARKER_POINT_LIMIT = 2_000;

export type AxisRange = readonly [number, number];

/**
 * Where a value sits on a line's x axis: a number as itself, a date as epoch milliseconds, NaN when
 * it has neither. The API sends every cell as a string, so a numeric string is read as a number
 * before it is tried as a date.
 */
export function axisPosition(value: string | number | Date | null): number {
  if (typeof value === "number") {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string") {
    const asNumber = Number(value);
    const isNumeric = value.trim() !== "" && Number.isFinite(asNumber);
    return isNumeric ? asNumber : Date.parse(value);
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
 * in step. The chart's lines share one bucket budget, so ten lines draw no more than one would. Their
 * markers come from the chart's style, never per point, so only data arrays need thinning, and they
 * are dropped while the lines show more points than markers can mark. Dropping them counts as a
 * reduction, so the chart still offers its own style back. Stacked areas stay whole: they stack by
 * index, so thinning each on its own would pair the wrong points.
 */
export function reduceSeries(
  series: CartesianSeries[],
  positions: readonly number[][],
  rangeFor: (series: CartesianSeries) => AxisRange | undefined,
): { series: CartesianSeries[]; isReduced: boolean } {
  const isLine = (one: CartesianSeries) => one.traceType === "line" || one.traceType === "area";
  const reducibleLines = series.filter((one) => isLine(one) && !one.stackgroup).length;
  const bucketsPerLine = Math.max(
    MIN_BUCKETS_PER_LINE,
    Math.floor(REDUCTION_BUCKETS / Math.max(1, reducibleLines)),
  );

  let visibleLinePoints = 0;

  const reduced = series.map((one, index) => {
    if (!isLine(one)) {
      return one;
    }
    const xs = positions[index] ?? [];
    const range = rangeFor(one) ?? [xs[0], xs[xs.length - 1]];
    const isReducible = !one.stackgroup && xs.length > 4 * bucketsPerLine;
    if (!isReducible) {
      visibleLinePoints += countInRange(xs, range);
      return one;
    }

    const ys = one.y.map((y) => (typeof y === "number" ? y : null));
    const picked = m4Indices(xs, ys, range, bucketsPerLine);
    visibleLinePoints += picked.length;
    return picked.length === xs.length ? one : pickPoints(one, picked);
  });

  const isThinned = reduced.some((one, index) => one !== series[index]);
  const hasMarkedLines = reduced.some((one) => isLine(one) && one.mode === "lines+markers");
  const isDroppingMarkers = hasMarkedLines && visibleLinePoints > MARKER_POINT_LIMIT;
  const drawn = isDroppingMarkers
    ? reduced.map((one) =>
        isLine(one) && one.mode === "lines+markers" ? { ...one, mode: "lines" as const } : one,
      )
    : reduced;

  return { series: drawn, isReduced: isThinned || isDroppingMarkers };
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
