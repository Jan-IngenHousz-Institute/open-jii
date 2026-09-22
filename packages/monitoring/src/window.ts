import { aggregate, normalizeAbsent } from "./baseline.js";
import type { CatalogMetric } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Weeks back the daily digest compares against, all on the same weekday. */
const BASELINE_WEEKS = [1, 2, 3, 4];

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface RegionEntry {
  metric: CatalogMetric;
  index: number;
}

/** One series as GetMetricData returns it; a SEARCH expression returns several per Id. */
export interface SeriesResult {
  Id?: string;
  Values?: number[];
  /** Complete | PartialData | InternalError | Forbidden. Only the first is a reading. */
  StatusCode?: string;
}

function window(from: number, to: number): TimeWindow {
  return { start: new Date(from), end: new Date(to) };
}

export function dailyWindows(now: number): { current: TimeWindow; history: TimeWindow[] } {
  return {
    current: window(now - DAY_MS, now),
    history: BASELINE_WEEKS.map((weeks) =>
      window(now - DAY_MS - weeks * WEEK_MS, now - weeks * WEEK_MS),
    ),
  };
}

export function weeklyWindows(now: number): { current: TimeWindow; prior: TimeWindow } {
  return {
    current: window(now - WEEK_MS, now),
    prior: window(now - 2 * WEEK_MS, now - WEEK_MS),
  };
}

/**
 * Groups metrics for one GetMetricData call each. The index is the metric's position in
 * the original list, which is what carries its identity through the query and back.
 */
export function groupByRegion(metrics: CatalogMetric[]): Map<string, RegionEntry[]> {
  const byRegion = new Map<string, RegionEntry[]>();

  metrics.forEach((metric, index) => {
    const region = metric.signal?.region ?? "default";
    byRegion.set(region, [...(byRegion.get(region) ?? []), { metric, index }]);
  });

  return byRegion;
}

/** Collects a response's series back onto the metric indices that asked for them. */
export function readSeries(
  results: SeriesResult[] | undefined,
  into = new Map<number, number[]>(),
): Map<number, number[]> {
  for (const series of results ?? []) {
    if (series.Id === undefined) {
      continue;
    }
    const index = Number(series.Id.slice(1));
    into.set(index, [...(into.get(index) ?? []), ...(series.Values ?? [])]);
  }

  return into;
}

/**
 * Metric indices whose series did not come back whole.
 *
 * A Forbidden or InternalError result carries no values, and PartialData carries too few.
 * Left alone, each would aggregate to an absent Sum, which normalizes to zero and reports
 * an error counter we were not allowed to read as healthy.
 */
export function incompleteSeries(results: SeriesResult[] | undefined): number[] {
  const indices = new Set<number>();

  for (const series of results ?? []) {
    if (
      series.Id !== undefined &&
      series.StatusCode !== undefined &&
      series.StatusCode !== "Complete"
    ) {
      indices.add(Number(series.Id.slice(1)));
    }
  }

  return [...indices];
}

/** Folds one attempt's series into the window's, so a retry never re-adds its own page. */
export function mergeSeries(
  into: Map<number, number[]>,
  from: ReadonlyMap<number, number[]>,
): Map<number, number[]> {
  for (const [index, values] of from) {
    into.set(index, [...(into.get(index) ?? []), ...values]);
  }

  return into;
}

/**
 * Turns collected series into one value per metric.
 *
 * Absent and unasked are different facts, which is the whole reason this takes
 * `unqueried`: an absent Sum normalizes to zero, so a metric from a region we failed to
 * read would otherwise report an error counter of zero, meaning healthy.
 */
export function assembleWindow(
  metrics: CatalogMetric[],
  values: Map<number, number[]>,
  unqueried: ReadonlySet<number>,
): (number | null)[] {
  return metrics.map((metric, index) => {
    if (unqueried.has(index)) {
      return null;
    }
    const series = values.get(index);
    const stat = metric.signal?.stat;

    return normalizeAbsent(series === undefined ? null : aggregate(series, stat), stat);
  });
}
