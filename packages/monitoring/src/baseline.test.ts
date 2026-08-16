import { describe, expect, it } from "vitest";

import {
  aggregate,
  averageBaseline,
  deviationPercent,
  evaluate,
  normalizeAbsent,
} from "./baseline.js";
import type { CatalogMetric, MetricBaseline } from "./types.js";

function reading(
  baseline: MetricBaseline | undefined,
  value: number | null,
  baselineValue: number | null = null,
  historyCount = 4,
) {
  const metric = {
    num: 1,
    id: "m",
    name: "Metric",
    family: "observability",
    source: "aws",
    phase: "P1",
    active: true,
    slots: ["exception"],
    baseline,
  } as CatalogMetric;

  return { metric, value, baseline: baselineValue, historyCount };
}

describe("normalizeAbsent", () => {
  it("treats an absent counter as zero events", () => {
    expect(normalizeAbsent(null, "Sum")).toBe(0);
  });

  it("leaves an absent gauge null so silence stays visible", () => {
    expect(normalizeAbsent(null, "Maximum")).toBeNull();
  });
});

describe("aggregate", () => {
  it("sums counters, maxes gauges, averages everything else", () => {
    expect(aggregate([1, 2, 3], "Sum")).toBe(6);
    expect(aggregate([1, 9, 3], "Maximum")).toBe(9);
    expect(aggregate([2, 4], "Average")).toBe(3);
  });

  it("returns null for an empty window", () => {
    expect(aggregate([], "Sum")).toBeNull();
  });
});

describe("averageBaseline", () => {
  it("ignores weeks with no data", () => {
    expect(averageBaseline([10, null, 20, null])).toBe(15);
  });

  it("is null when no week reported", () => {
    expect(averageBaseline([null, null])).toBeNull();
  });
});

describe("deviationPercent", () => {
  it("is null against a zero or missing baseline", () => {
    expect(deviationPercent(5, 0)).toBeNull();
    expect(deviationPercent(5, null)).toBeNull();
  });

  it("reports signed percentage change", () => {
    expect(deviationPercent(150, 100)).toBe(50);
    expect(deviationPercent(50, 100)).toBe(-50);
  });
});

describe("evaluate", () => {
  it("reports a series that used to report and now does not", () => {
    expect(evaluate(reading(undefined, null, 10, 4)).state).toBe("missing");
  });

  it("does not report a series that never reported", () => {
    expect(evaluate(reading(undefined, null, null, 0)).state).toBe("no-data");
  });

  it("flags values above a hard threshold", () => {
    expect(evaluate(reading({ method: "threshold", max: 600000 }, 900000)).state).toBe("anomaly");
    expect(evaluate(reading({ method: "threshold", max: 600000 }, 10)).state).toBe("ok");
  });

  it("flags any nonzero for error counters", () => {
    expect(evaluate(reading({ anomaly: "any-nonzero" }, 1)).state).toBe("anomaly");
    expect(evaluate(reading({ anomaly: "any-nonzero" }, 0)).state).toBe("ok");
  });

  it("flags deviation beyond the configured percentage", () => {
    const result = evaluate(reading({ method: "same-weekday-4w", anomaly_pct: 100 }, 300, 100));
    expect(result.state).toBe("anomaly");
    expect(result.reason).toBe("+200% vs 4-week baseline");
  });

  it("stays ok within the configured deviation", () => {
    expect(evaluate(reading({ method: "same-weekday-4w", anomaly_pct: 100 }, 150, 100)).state).toBe(
      "ok",
    );
  });

  it("cannot flag deviation before a baseline exists", () => {
    expect(
      evaluate(reading({ method: "same-weekday-4w", anomaly_pct: 100 }, 500, null)).state,
    ).toBe("ok");
  });

  it("never flags a liveness metric that carries no rule", () => {
    expect(evaluate(reading({ nodata: "alert" }, 1)).state).toBe("ok");
  });
});
