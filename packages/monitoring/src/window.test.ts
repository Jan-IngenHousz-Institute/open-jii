import { describe, expect, it } from "vitest";

import type { CatalogMetric, MetricSignal } from "./types.js";
import {
  assembleWindow,
  dailyWindows,
  groupByRegion,
  incompleteSeries,
  mergeSeries,
  readSeries,
  weeklyWindows,
} from "./window.js";

function metric(id: string, signal: MetricSignal): CatalogMetric {
  return {
    num: 1,
    id,
    name: id,
    family: "observability",
    source: "aws",
    phase: "P1",
    active: true,
    slots: ["exception"],
    signal,
  };
}

const NOON = Date.UTC(2026, 8, 21, 12, 0, 0);

describe("dailyWindows", () => {
  it("compares the last day against the same day of the previous four weeks", () => {
    const { current, history } = dailyWindows(NOON);

    expect(current.end.toISOString()).toBe("2026-09-21T12:00:00.000Z");
    expect(current.start.toISOString()).toBe("2026-09-20T12:00:00.000Z");

    expect(history).toHaveLength(4);
    expect(history.map((w) => w.end.toISOString())).toEqual([
      "2026-09-14T12:00:00.000Z",
      "2026-09-07T12:00:00.000Z",
      "2026-08-31T12:00:00.000Z",
      "2026-08-24T12:00:00.000Z",
    ]);
    // Every baseline window is the same 24h slice of the same weekday, which is what
    // makes a Monday morning comparable to a Monday morning rather than to a Sunday.
    for (const past of history) {
      expect(past.end.getTime() - past.start.getTime()).toBe(
        current.end.getTime() - current.start.getTime(),
      );
      expect(past.end.getUTCDay()).toBe(current.end.getUTCDay());
    }
  });
});

describe("weeklyWindows", () => {
  it("puts the two weeks back to back with no gap or overlap", () => {
    const { current, prior } = weeklyWindows(NOON);

    expect(prior.end.getTime()).toBe(current.start.getTime());
    expect(current.end.getTime() - current.start.getTime()).toBe(
      prior.end.getTime() - prior.start.getTime(),
    );
  });
});

describe("groupByRegion", () => {
  it("batches metrics without a region together and keeps each one's index", () => {
    const grouped = groupByRegion([
      metric("a", { stat: "Sum" }),
      metric("b", { stat: "Sum", region: "us-east-1" }),
      metric("c", { stat: "Sum" }),
    ]);

    expect([...grouped.keys()]).toEqual(["default", "us-east-1"]);
    expect(grouped.get("default")?.map((entry) => entry.index)).toEqual([0, 2]);
    expect(grouped.get("us-east-1")?.map((entry) => entry.index)).toEqual([1]);
  });
});

describe("readSeries", () => {
  it("merges the several series a SEARCH expression returns under one id", () => {
    const values = readSeries([
      { Id: "m0", Values: [1, 2] },
      { Id: "m0", Values: [3] },
      { Id: "m1", Values: [9] },
    ]);

    expect(values.get(0)).toEqual([1, 2, 3]);
    expect(values.get(1)).toEqual([9]);
  });

  it("accumulates across calls so a per-metric retry adds to what the batch returned", () => {
    const values = readSeries([{ Id: "m0", Values: [1] }]);
    readSeries([{ Id: "m1", Values: [2] }], values);

    expect([...values.keys()]).toEqual([0, 1]);
  });

  it("drops a series with no id rather than collecting it under NaN", () => {
    const values = readSeries([{ Values: [1] }, { Id: "m0", Values: [2] }]);

    expect([...values.keys()]).toEqual([0]);
  });
});

describe("incompleteSeries", () => {
  it("names the metric behind any status other than Complete", () => {
    expect(
      incompleteSeries([
        { Id: "m0", Values: [1], StatusCode: "Complete" },
        { Id: "m1", Values: [], StatusCode: "Forbidden" },
        { Id: "m2", Values: [], StatusCode: "InternalError" },
        { Id: "m3", Values: [1], StatusCode: "PartialData" },
      ]),
    ).toEqual([1, 2, 3]);
  });

  it("treats one bad series of a SEARCH as spoiling that metric's total", () => {
    // A SEARCH returns one series per match under a single Id. A Sum missing one of them
    // is not a smaller number, it is the wrong number.
    expect(
      incompleteSeries([
        { Id: "m0", Values: [1], StatusCode: "Complete" },
        { Id: "m0", Values: [], StatusCode: "InternalError" },
      ]),
    ).toEqual([0]);
  });

  it("accepts a response that reports no status at all", () => {
    expect(incompleteSeries([{ Id: "m0", Values: [1] }])).toEqual([]);
    expect(incompleteSeries(undefined)).toEqual([]);
  });
});

describe("mergeSeries", () => {
  it("appends rather than replaces, so a paged read keeps both pages", () => {
    const window = new Map([[0, [1, 2]]]);
    mergeSeries(window, new Map([[0, [3]]]));

    expect(window.get(0)).toEqual([1, 2, 3]);
  });

  it("does not touch the window when the attempt collected nothing", () => {
    const window = new Map([[0, [1]]]);
    mergeSeries(window, new Map());

    expect([...window]).toEqual([[0, [1]]]);
  });
});

describe("assembleWindow", () => {
  const metrics = [
    metric("errors", { stat: "Sum" }),
    metric("age", { stat: "Maximum" }),
    metric("other-errors", { stat: "Sum" }),
  ];

  it("reads an absent Sum as zero events and an absent gauge as no data", () => {
    const values = assembleWindow(metrics, new Map(), new Set());

    expect(values).toEqual([0, null, 0]);
  });

  it("keeps an unqueried Sum absent, so a region we could not read never reports healthy", () => {
    const values = assembleWindow(metrics, new Map([[0, [4]]]), new Set([2]));

    expect(values).toEqual([4, null, null]);
  });

  it("aggregates each series by its own statistic", () => {
    const values = assembleWindow(
      metrics,
      new Map([
        [0, [1, 2, 3]],
        [1, [5, 9, 7]],
      ]),
      new Set(),
    );

    expect(values).toEqual([6, 9, 0]);
  });
});
