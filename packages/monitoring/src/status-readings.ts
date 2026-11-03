import type { RegionQueries, StatusReadings, StatusSignal } from "./status-components.js";

/** The parts of a GetMetricData result a reading needs, so the package needs no SDK. */
interface MetricDataResult {
  Id?: string;
  Timestamps?: Date[];
  Values?: number[];
}

type ReadingSpec = RegionQueries["readings"][number];

function pointsWithin(result: MetricDataResult, since: number) {
  const timestamps = result.Timestamps ?? [];
  const values = result.Values ?? [];

  return timestamps.flatMap((timestamp, index) => {
    const value = values.at(index);
    const isInWindow =
      timestamp.getTime() >= since && value !== undefined && Number.isFinite(value);
    return isInWindow ? [{ at: timestamp.getTime(), value }] : [];
  });
}

/** Floored to the period so the bucket that contains the window's start is kept, not just the ones after it. */
function windowStart(spec: ReadingSpec, now: Date): number {
  const periodMs = spec.periodSeconds * 1000;
  const start = now.getTime() - spec.lookbackMinutes * 60_000;
  return Math.floor(start / periodMs) * periodMs;
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
    const points = (byId.get(spec.id) ?? []).flatMap((result) => pointsWithin(result, since));
    const value = collapse(points, spec.reduce);

    if (value !== undefined) {
      readings[spec.id] = value;
    }
  }

  return readings;
}
