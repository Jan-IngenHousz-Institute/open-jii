import { describe, expect, it } from "vitest";

import { batchByNamespace, parseObservations } from "./forwarder.js";

const observationLine = JSON.stringify({
  namespace: "OpenJII/Data",
  metric: "CollectorHeartbeat",
  value: 1,
  unit: "Count",
  timestamp: "2026-08-16T06:15:00Z",
  dimensions: { Environment: "dev" },
});

describe("parseObservations", () => {
  it("converts a metric line into a CloudWatch datum", () => {
    const { observations, skipped } = parseObservations(observationLine);

    expect(skipped).toEqual([]);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      namespace: "OpenJII/Data",
      datum: {
        MetricName: "CollectorHeartbeat",
        Value: 1,
        Unit: "Count",
        Dimensions: [{ Name: "Environment", Value: "dev" }],
      },
    });
    expect(observations[0]?.datum.Timestamp.toISOString()).toBe("2026-08-16T06:15:00.000Z");
  });

  it("passes over roster lines silently so cardinality stays out of CloudWatch", () => {
    const roster = JSON.stringify({ detail: "stale_experiments", rows: [{ experiment_id: "a" }] });

    const { observations, skipped } = parseObservations(roster);

    expect(observations).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it("skips lines the forwarder role may not publish", () => {
    const foreign = JSON.stringify({
      namespace: "Custom/Other",
      metric: "M",
      value: 1,
      timestamp: "2026-08-16T06:15:00Z",
    });

    const { observations, skipped } = parseObservations(foreign);

    expect(observations).toEqual([]);
    expect(skipped).toEqual([{ line: 1, reason: "namespace Custom/Other" }]);
  });

  it("reports the line number of malformed json without dropping the rest of the file", () => {
    const { observations, skipped } = parseObservations(`not json\n${observationLine}`);

    expect(observations).toHaveLength(1);
    expect(skipped).toEqual([{ line: 1, reason: "invalid json" }]);
  });

  it("rejects unusable timestamps and values", () => {
    const badTimestamp = JSON.stringify({
      namespace: "OpenJII/Data",
      metric: "M",
      value: 1,
      timestamp: "never",
    });
    const badValue = JSON.stringify({
      namespace: "OpenJII/Data",
      metric: "M",
      value: "high",
      timestamp: "2026-08-16T06:15:00Z",
    });

    expect(parseObservations(badTimestamp).skipped).toEqual([
      { line: 1, reason: "invalid timestamp" },
    ]);
    expect(parseObservations(badValue).skipped).toEqual([{ line: 1, reason: "invalid value" }]);
  });

  it("rejects a non-string metric name instead of publishing [object Object]", () => {
    const objectName = JSON.stringify({
      namespace: "OpenJII/Data",
      metric: { nested: true },
      value: 1,
      timestamp: "2026-08-16T06:15:00Z",
    });

    const { observations, skipped } = parseObservations(objectName);

    expect(observations).toEqual([]);
    expect(skipped).toEqual([{ line: 1, reason: "invalid metric name" }]);
  });

  it("ignores blank lines, including a trailing newline", () => {
    const { observations, skipped } = parseObservations(`${observationLine}\n\n`);

    expect(observations).toHaveLength(1);
    expect(skipped).toEqual([]);
  });

  it("defaults a missing unit rather than failing the line", () => {
    const noUnit = JSON.stringify({
      namespace: "OpenJII/Data",
      metric: "M",
      value: 2,
      timestamp: "2026-08-16T06:15:00Z",
    });

    expect(parseObservations(noUnit).observations[0]?.datum.Unit).toBe("None");
  });
});

describe("batchByNamespace", () => {
  it("splits per namespace and respects the batch size", () => {
    const { observations } = parseObservations(
      [
        observationLine,
        JSON.stringify({
          namespace: "OpenJII/Usage",
          metric: "U",
          value: 3,
          timestamp: "2026-08-16T06:15:00Z",
        }),
        JSON.stringify({
          namespace: "OpenJII/Data",
          metric: "D",
          value: 4,
          timestamp: "2026-08-16T06:15:00Z",
        }),
      ].join("\n"),
    );

    const batches = batchByNamespace(observations, 1);

    expect(batches).toHaveLength(3);
    expect(batches.filter((batch) => batch.namespace === "OpenJII/Data")).toHaveLength(2);
    expect(batches.every((batch) => batch.data.length === 1)).toBe(true);
  });

  it("keeps one call per namespace when under the batch size", () => {
    const { observations } = parseObservations(observationLine);

    expect(batchByNamespace(observations, 100)).toHaveLength(1);
  });
});
