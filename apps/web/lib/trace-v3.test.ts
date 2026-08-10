import liveAmbitEnvelope from "@/test/fixtures/ambit-trace-v3-live.json";
import { describe, expect, it } from "vitest";

import { enrichDirectTracePayload, normalizeTracePayload } from "./trace-v3";

function trace(label: string, series: Record<string, unknown> = {}) {
  return {
    schema: "ambit.trace/3",
    label,
    time: { duration_ms: 1000 },
    protocol: { cal_version: "cal-v1" },
    series,
  };
}

describe("normalizeTracePayload", () => {
  it("normalizes the exact live T3 direct-envelope shape", () => {
    const normalized = normalizeTracePayload(liveAmbitEnvelope);

    expect(normalized?.location).toBe("sample-set");
    expect(normalized?.traces).toHaveLength(1);
    expect(normalized?.trace).toMatchObject({
      schema: "ambit.trace/3",
      sensor_id: "10:91:A8:4F:4F:C0",
      time: { duration_ms: 1845 },
    });
    expect(normalized?.series.find((series) => series.name === "fluo_630_signal")).toMatchObject({
      unit: "count",
      relativeTimeSeconds: [
        0, 0.0854, 0.1708, 0.2562, 0.3416, 0.427, 0.5124, 0.5978, 0.6832, 0.854, 1.0248, 1.1956,
        1.3664, 1.5372, 1.708, 1.8788,
      ],
      omittedPointCount: 0,
    });
  });

  it("normalizes bare regular, subsampled, explicit, and estimated series", () => {
    const normalized = normalizeTracePayload({
      schema: "future.trace/1",
      series: {
        regular: { u: "count", t0: 0, dt: 0.5, v: [1, 2, 3] },
        subsampled: { u: "count", t0: 0.35, dt: 0.8, v: [4, 5] },
        explicit: { u: "Cel", t: [0, 2.1, 5], v: [20, 21, 22], t_est: true },
      },
    });

    expect(normalized?.location).toBe("bare");
    expect(normalized?.series).toEqual([
      {
        name: "regular",
        unit: "count",
        values: [1, 2, 3],
        relativeTimeSeconds: [0, 0.5, 1],
        estimatedTime: false,
        omittedPointCount: 0,
      },
      {
        name: "subsampled",
        unit: "count",
        values: [4, 5],
        relativeTimeSeconds: [0.35, 1.15],
        estimatedTime: false,
        omittedPointCount: 0,
      },
      {
        name: "explicit",
        unit: "Cel",
        values: [20, 21, 22],
        relativeTimeSeconds: [0, 2.1, 5],
        estimatedTime: true,
        omittedPointCount: 0,
      },
    ]);
  });

  it.each([
    ["snapshot", { snapshot: { temperature: 21 } }],
    ["error", { error: "prior attempt failed" }],
  ])("finds a trace after a preceding %s set member", (_kind, preceding) => {
    const response = {
      sample: [{ set: [preceding, trace("run-1", { signal: { u: "V", t: [0], v: [2] } })] }],
    };
    const normalized = normalizeTracePayload(response);

    expect(normalized?.traces).toHaveLength(1);
    expect(normalized?.traces[0]).toMatchObject({ setIndex: 1, trace: { label: "run-1" } });
  });

  it("preserves two arrun traces in set order", () => {
    const response = {
      sample: [
        {
          set: [
            { snapshot: true },
            trace("run-1", { signal: { u: "V", t: [0], v: [1] } }),
            { error: "between runs" },
            trace("run-2", { signal: { u: "V", t: [0, 2], v: [2, 3] } }),
          ],
        },
      ],
    };

    expect(normalizeTracePayload(response)?.traces.map((run) => run.trace.label)).toEqual([
      "run-1",
      "run-2",
    ]);
  });

  it("keeps every repeated protocol trace when protocol_repeats is greater than one", () => {
    const repeated = {
      sample: [
        {
          set: [
            trace("repeat-1", { signal: { u: "V", t0: 0, dt: 1, v: [1] } }),
            trace("repeat-2", { signal: { u: "V", t0: 0, dt: 1, v: [2] } }),
            trace("repeat-3", { signal: { u: "V", t0: 0, dt: 1, v: [3] } }),
          ],
        },
      ],
    };

    expect(normalizeTracePayload(repeated)?.traces).toHaveLength(3);
  });

  it("renders the valid matched subset of malformed explicit points", () => {
    const normalized = normalizeTracePayload({
      schema: "ambit.trace/3",
      series: {
        mismatch: { u: "count", t: [0, Number.NaN, 2], v: [10, 11, 12, 13] },
      },
    });

    expect(normalized?.series[0]).toMatchObject({
      values: [10, 12],
      relativeTimeSeconds: [0, 2],
      omittedPointCount: 2,
    });
    expect(normalized?.traces[0]?.invalidSeriesCount).toBe(0);
  });

  it.each([
    ["non-positive dt", { u: "V", t0: 0, dt: 0, v: [1, 2] }],
    ["negative dt", { u: "V", t0: 0, dt: -1, v: [1, 2] }],
    ["empty explicit values", { u: "V", t: [], v: [] }],
    ["empty regular values", { u: "V", t0: 0, dt: 1, v: [] }],
    ["all non-finite explicit points", { u: "V", t: [0], v: [Number.POSITIVE_INFINITY] }],
    ["malformed explicit time", { u: "V", t: "bad", t0: 0, dt: 1, v: [1] }],
  ])("retains an invalid trace payload but rejects its %s series", (_label, invalidSeries) => {
    const normalized = normalizeTracePayload({
      schema: "ambit.trace/3",
      series: { invalid: invalidSeries },
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.series).toEqual([]);
    expect(normalized?.traces[0]?.invalidSeriesCount).toBe(1);
  });

  it("accepts a self-describing series object without a schema and rejects raw JSON", () => {
    expect(
      normalizeTracePayload({ series: { voltage: { u: "V", t0: 1, dt: 2, v: [3, 4] } } }),
    ).not.toBeNull();
    expect(normalizeTracePayload({ series: { voltage: [3, 4] } })).toBeNull();
    expect(normalizeTracePayload({ sample: [{ set: [{ s_630: [1, 2] }] }] })).toBeNull();
  });
});

describe("enrichDirectTracePayload", () => {
  it("immutably enriches every trace while preserving non-trace set records and order", () => {
    const snapshot = { snapshot: { temperature: 21 } };
    const error = { error: "prior attempt failed" };
    const response = {
      sample: [
        {
          set: [
            snapshot,
            trace("run-1", { signal: { u: "V", t: [0], v: [1] } }),
            error,
            trace("run-2", { signal: { u: "V", t: [0, 1], v: [2, 3] } }),
          ],
        },
      ],
    };
    const enriched = enrichDirectTracePayload(response, {
      startUtc: 1785965160359,
      endUtc: 1785965162199,
      protocolId: "b1946ac9-6ca8-4c65-a7cf-e66302c3c229",
      protocolName: "Mixed cadence",
    });
    const normalized = normalizeTracePayload(enriched);
    const enrichedSet = (enriched as typeof response).sample[0]?.set;

    expect(normalized?.traces).toHaveLength(2);
    for (const run of normalized?.traces ?? []) {
      expect(run.trace.time).toEqual({
        duration_ms: 1000,
        start_utc: 1785965160359,
        end_utc: 1785965162199,
      });
      expect(run.trace.protocol).toEqual({
        id: "b1946ac9-6ca8-4c65-a7cf-e66302c3c229",
        name: "Mixed cadence",
        cal_version: "cal-v1",
      });
    }
    expect(enrichedSet[0]).toBe(snapshot);
    expect(enrichedSet[2]).toBe(error);
    expect(enriched).not.toBe(response);
    expect(response.sample[0]?.set[1]).not.toHaveProperty("time.start_utc");
    expect(response.sample[0]?.set[3]).not.toHaveProperty("protocol.id");
  });

  it("enriches the exact live T3 trace without changing the fixture", () => {
    const enriched = enrichDirectTracePayload(liveAmbitEnvelope, {
      startUtc: 1785965160359,
      endUtc: 1785965162199,
      protocolId: "b1946ac9-6ca8-4c65-a7cf-e66302c3c229",
      protocolName: "Mixed cadence",
    });
    const normalized = normalizeTracePayload(enriched);

    expect(normalized?.trace.protocol).toMatchObject({
      id: "b1946ac9-6ca8-4c65-a7cf-e66302c3c229",
      name: "Mixed cadence",
      cal_version: "439a0ac8",
    });
    expect(normalizeTracePayload(liveAmbitEnvelope)?.trace.time).toEqual({ duration_ms: 1845 });
  });

  it("leaves non-trace responses unchanged", () => {
    const response = { sample: [{ set: [{ s_630: [1, 2] }] }] };
    expect(
      enrichDirectTracePayload(response, {
        startUtc: 1,
        endUtc: 2,
        protocolId: "protocol-id",
        protocolName: "Protocol",
      }),
    ).toBe(response);
  });
});
