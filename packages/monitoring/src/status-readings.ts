import type { RegionQueries, StatusReadings, StatusSignal } from "./status-components.js";

/** The parts of a GetMetricData result a reading needs, so the package needs no SDK. */
interface MetricDataResult {
  Id?: string;
  StatusCode?: string;
  Timestamps?: Date[];
  Values?: number[];
}

interface MetricDataPage {
  NextToken?: string;
  MetricDataResults?: MetricDataResult[];
}

const UNREADABLE_STATUS_CODES = new Set(["Forbidden", "InternalError"]);

/**
 * Results CloudWatch could not answer. They would read as no datapoints, which the judge takes for a
 * quiet signal or a silent producer, so the run has to stop instead. PartialData only means more
 * pages follow until the last one.
 */
export function unreadableResults(page: MetricDataPage): MetricDataResult[] {
  const isLastPage = !page.NextToken;

  return (page.MetricDataResults ?? []).filter(
    ({ StatusCode = "" }) =>
      UNREADABLE_STATUS_CODES.has(StatusCode) || (isLastPage && StatusCode === "PartialData"),
  );
}

type ReadingSpec = RegionQueries["readings"][number];

function pointsWithin(result: MetricDataResult, since: number, until: number) {
  const timestamps = result.Timestamps ?? [];
  const values = result.Values ?? [];

  return timestamps.flatMap((timestamp, index) => {
    const value = values.at(index);
    const at = timestamp.getTime();
    const isInWindow = at >= since && at < until && value !== undefined && Number.isFinite(value);
    return isInWindow ? [{ at: timestamp.getTime(), value }] : [];
  });
}

/** Floored to the period so the bucket that contains the window's start is kept, not just the ones after it. */
function windowStart(spec: ReadingSpec, now: Date): number {
  const periodMs = spec.periodSeconds * 1000;
  const start = now.getTime() - spec.lookbackMinutes * 60_000;
  return Math.floor(start / periodMs) * periodMs;
}

/** A window that ends before now stops at the start of the bucket it ends in. */
function windowEnd(spec: ReadingSpec, now: Date): number {
  if (!spec.endMinutesAgo) {
    return Number.POSITIVE_INFINITY;
  }

  const periodMs = spec.periodSeconds * 1000;
  return Math.floor((now.getTime() - spec.endMinutesAgo * 60_000) / periodMs) * periodMs;
}

/** A page boundary can split one query's series across results, so every result of an Id counts. */
function groupById(results: MetricDataResult[]): Map<string, MetricDataResult[]> {
  const byId = new Map<string, MetricDataResult[]>();

  for (const result of results) {
    if (result.Id !== undefined) {
      byId.set(result.Id, [...(byId.get(result.Id) ?? []), result]);
    }
  }

  return byId;
}

function collapse(points: { at: number; value: number }[], reduce: StatusSignal["reduce"]) {
  if (points.length === 0) {
    return undefined;
  }

  if (reduce === "sum") {
    return points.reduce((total, point) => total + point.value, 0);
  }

  if (reduce === "max") {
    return Math.max(...points.map((point) => point.value));
  }

  const newest = points.reduce((latest, point) => (point.at > latest.at ? point : latest));
  return newest.value;
}

/**
 * Turns one region's GetMetricData results into readings, each over its own lookback. A signal
 * with no datapoint in its window has no reading, which the judge reads per signal: an absent
 * count is none, an absent heartbeat is a silent producer.
 */
export function collapseReadings(
  specs: ReadingSpec[],
  results: MetricDataResult[],
  now: Date,
): StatusReadings {
  const byId = groupById(results);
  const readings: StatusReadings = {};

  for (const spec of specs) {
    const since = windowStart(spec, now);
    const until = windowEnd(spec, now);
    const points = (byId.get(spec.id) ?? []).flatMap((result) =>
      pointsWithin(result, since, until),
    );
    const value = collapse(points, spec.reduce);

    if (value !== undefined) {
      readings[spec.id] = value;
    }
  }

  return readings;
}
