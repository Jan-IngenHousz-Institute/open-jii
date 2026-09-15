import type { Evaluation, MetricReading } from "./types.js";

/** Absent datapoints for a counter mean zero events, not a broken signal. */
export function normalizeAbsent(value: number | null, stat: string | undefined): number | null {
  if (value === null && stat === "Sum") {
    return 0;
  }
  return value;
}

export function aggregate(values: number[], stat: string | undefined): number | null {
  if (values.length === 0) {
    return null;
  }

  if (stat === "Sum") {
    return values.reduce((total, value) => total + value, 0);
  }
  if (stat === "Maximum") {
    return Math.max(...values);
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function averageBaseline(history: (number | null)[]): number | null {
  const present = history.filter((value): value is number => value !== null);
  if (present.length === 0) {
    return null;
  }
  return present.reduce((total, value) => total + value, 0) / present.length;
}

export function deviationPercent(value: number, baseline: number | null): number | null {
  if (baseline === null || baseline === 0) {
    return null;
  }
  return ((value - baseline) / baseline) * 100;
}

export function evaluate({ metric, value, baseline, historyCount }: MetricReading): Evaluation {
  const rule = metric.baseline ?? {};

  if (value === null) {
    // A series that used to report and now does not is itself the finding
    return historyCount > 0 ? { state: "missing" } : { state: "no-data" };
  }

  if (rule.method === "threshold" && rule.max !== undefined) {
    return value > rule.max
      ? { state: "anomaly", reason: `above threshold ${rule.max}` }
      : { state: "ok" };
  }

  if (rule.anomaly === "any-nonzero") {
    return value > 0 ? { state: "anomaly", reason: "nonzero" } : { state: "ok" };
  }

  if (typeof rule.anomaly_pct === "number") {
    const deviation = deviationPercent(value, baseline);
    if (deviation !== null && Math.abs(deviation) > rule.anomaly_pct) {
      return {
        state: "anomaly",
        reason: `${deviation > 0 ? "+" : ""}${deviation.toFixed(0)}% vs 4-week baseline`,
      };
    }
  }

  return { state: "ok" };
}
