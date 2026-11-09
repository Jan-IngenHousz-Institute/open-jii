import { describe, expect, it } from "vitest";

import { collapseReadings, unreadableResults } from "./status-readings.js";

const now = new Date("2026-11-03T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

describe("collapseReadings", () => {
  it("sums the points inside a signal's own lookback and ignores older ones", () => {
    const readings = collapseReadings(
      [{ id: "ingestForwardingFailures", periodSeconds: 60, lookbackMinutes: 15, reduce: "sum" }],
      [
        {
          Id: "ingestForwardingFailures",
          Timestamps: [minutesAgo(1), minutesAgo(14), minutesAgo(16)],
          Values: [2, 3, 100],
        },
      ],
      now,
    );

    expect(readings).toEqual({ ingestForwardingFailures: 5 });
  });

  it("takes the largest point for max and the newest point for latest", () => {
    const readings = collapseReadings(
      [
        { id: "ingestIteratorAge", periodSeconds: 60, lookbackMinutes: 5, reduce: "max" },
        { id: "ingestIdle", periodSeconds: 300, lookbackMinutes: 75, reduce: "latest" },
      ],
      [
        { Id: "ingestIteratorAge", Timestamps: [minutesAgo(1), minutesAgo(2)], Values: [10, 40] },
        { Id: "ingestIdle", Timestamps: [minutesAgo(5), minutesAgo(35)], Values: [2, 90] },
      ],
      now,
    );

    expect(readings).toEqual({ ingestIteratorAge: 40, ingestIdle: 2 });
  });

  it("reads a dependency down only when every check in its window failed", () => {
    const read = (values: number[]) =>
      collapseReadings(
        [{ id: "databaseUp", periodSeconds: 300, lookbackMinutes: 10, reduce: "max" }],
        [{ Id: "databaseUp", Timestamps: values.map((_, i) => minutesAgo(i * 5)), Values: values }],
        now,
      );

    expect(read([1, 0, 1])).toEqual({ databaseUp: 1 });
    expect(read([0, 1])).toEqual({ databaseUp: 1 });
    expect(read([0, 0])).toEqual({ databaseUp: 0 });
  });

  it("leaves a signal out when it has no point in its window or no result at all", () => {
    const readings = collapseReadings(
      [
        { id: "collectorHeartbeat", periodSeconds: 300, lookbackMinutes: 75, reduce: "latest" },
        { id: "macroBacklog", periodSeconds: 300, lookbackMinutes: 75, reduce: "latest" },
      ],
      [{ Id: "collectorHeartbeat", Timestamps: [minutesAgo(90)], Values: [1] }],
      now,
    );

    expect(readings).toEqual({});
  });

  it("combines the points of an Id that a page boundary split across results", () => {
    const readings = collapseReadings(
      [{ id: "ingestForwardingFailures", periodSeconds: 60, lookbackMinutes: 15, reduce: "sum" }],
      [
        { Id: "ingestForwardingFailures", Timestamps: [minutesAgo(1)], Values: [2] },
        { Id: "macroBacklog", Timestamps: [minutesAgo(1)], Values: [9] },
        { Id: "ingestForwardingFailures", Timestamps: [minutesAgo(2)], Values: [3] },
      ],
      now,
    );

    expect(readings).toEqual({ ingestForwardingFailures: 5 });
  });

  it("ignores values that are not finite numbers", () => {
    const readings = collapseReadings(
      [
        { id: "ingestForwardingFailures", periodSeconds: 60, lookbackMinutes: 15, reduce: "sum" },
        { id: "ingestIteratorAge", periodSeconds: 60, lookbackMinutes: 5, reduce: "max" },
      ],
      [
        {
          Id: "ingestForwardingFailures",
          Timestamps: [minutesAgo(1), minutesAgo(2), minutesAgo(3)],
          Values: [4, Number.NaN, Number.POSITIVE_INFINITY],
        },
        { Id: "ingestIteratorAge", Timestamps: [minutesAgo(1)], Values: [Number.NaN] },
      ],
      now,
    );

    expect(readings).toEqual({ ingestForwardingFailures: 4 });
  });

  it("keeps the bucket that holds the start of the window", () => {
    const midBucket = new Date("2026-11-03T12:03:00Z");
    const readings = collapseReadings(
      [{ id: "macroBacklog", periodSeconds: 300, lookbackMinutes: 10, reduce: "sum" }],
      [
        {
          Id: "macroBacklog",
          Timestamps: [
            new Date("2026-11-03T11:45:00Z"),
            new Date("2026-11-03T11:50:00Z"),
            new Date("2026-11-03T11:55:00Z"),
          ],
          Values: [100, 2, 3],
        },
      ],
      midBucket,
    );

    expect(readings).toEqual({ macroBacklog: 5 });
  });

  it("reads a window that ends before now from the buckets inside it only", () => {
    const readings = collapseReadings(
      [
        {
          id: "devicePublishesBeforeIdle",
          periodSeconds: 60,
          lookbackMinutes: 60,
          endMinutesAgo: 45,
          reduce: "sum",
        },
      ],
      [
        {
          Id: "devicePublishesBeforeIdle",
          Timestamps: [
            minutesAgo(61),
            minutesAgo(60),
            minutesAgo(46),
            minutesAgo(45),
            minutesAgo(1),
          ],
          Values: [1000, 3, 4, 100, 100],
        },
      ],
      now,
    );

    expect(readings).toEqual({ devicePublishesBeforeIdle: 7 });
  });
});

describe("unreadableResults", () => {
  const result = (Id: string, StatusCode: string) => ({ Id, StatusCode });

  it("stops the run on a result CloudWatch refused or failed to read", () => {
    const page = {
      MetricDataResults: [
        result("databaseUp", "Complete"),
        result("websiteRequests", "Forbidden"),
        result("ingestPublished", "InternalError"),
      ],
    };

    expect(unreadableResults(page).map(({ Id }) => Id)).toEqual([
      "websiteRequests",
      "ingestPublished",
    ]);
  });

  it("takes partial data as unreadable only on the last page", () => {
    const partial = [result("ingestPublished", "PartialData")];

    expect(unreadableResults({ NextToken: "next", MetricDataResults: partial })).toEqual([]);
    expect(unreadableResults({ MetricDataResults: partial })).toEqual(partial);
  });

  it("finds nothing to stop on a page without results", () => {
    expect(unreadableResults({})).toEqual([]);
  });
});
