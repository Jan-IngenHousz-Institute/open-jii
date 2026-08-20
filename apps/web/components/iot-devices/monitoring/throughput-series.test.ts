import { describe, expect, it } from "vitest";

import { MONITORING_MAX_SERIES } from "./monitoring-palette";
import { foldThroughputSeries } from "./throughput-series";

const AXIS = ["2026-08-13T00:00:00.000Z", "2026-08-13T01:00:00.000Z", "2026-08-13T02:00:00.000Z"];

const keyAsName = (key: string) => key;

describe("foldThroughputSeries", () => {
  it("zero-fills each series against the full axis", () => {
    const series = foldThroughputSeries(
      [{ key: "a", bucketStart: AXIS[1], count: 4 }],
      AXIS,
      keyAsName,
      "Other",
    );

    expect(series).toEqual([{ key: "a", name: "a", counts: [0, 4, 0] }]);
  });

  it("orders series alphabetically by display name", () => {
    const names = new Map([
      ["x", "Beta"],
      ["y", "Alpha"],
    ]);

    const series = foldThroughputSeries(
      [
        { key: "x", bucketStart: AXIS[0], count: 1 },
        { key: "y", bucketStart: AXIS[0], count: 1 },
      ],
      AXIS,
      (key) => names.get(key) ?? key,
      "Other",
    );

    expect(series.map((entry) => entry.name)).toEqual(["Alpha", "Beta"]);
  });

  it("folds series past the palette into one Other group summing their counts", () => {
    const keys = ["k1", "k2", "k3", "k4", "k5"].slice(0, MONITORING_MAX_SERIES + 1);
    const series = foldThroughputSeries(
      keys.map((key) => ({ key, bucketStart: AXIS[0], count: 1 })),
      AXIS,
      keyAsName,
      "Other",
    );

    expect(series).toHaveLength(MONITORING_MAX_SERIES);

    const other = series[series.length - 1];
    expect(other.name).toBe("Other");
    expect(other.counts).toEqual([2, 0, 0]);
  });

  it("accumulates duplicate key and bucket entries", () => {
    const series = foldThroughputSeries(
      [
        { key: "a", bucketStart: AXIS[0], count: 2 },
        { key: "a", bucketStart: AXIS[0], count: 3 },
      ],
      AXIS,
      keyAsName,
      "Other",
    );

    expect(series).toEqual([{ key: "a", name: "a", counts: [5, 0, 0] }]);
  });
});
