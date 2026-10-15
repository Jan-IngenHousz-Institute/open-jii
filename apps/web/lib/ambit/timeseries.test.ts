import { createAmbitTrace } from "@/test/factories";
import { describe, expect, it } from "vitest";

import { isMultispeqOutput } from "../multispeq/detect";
import { decodeAmbitTraces, findAmbitTraces } from "./timeseries";

describe("Ambit time series", () => {
  it("preserves values, units and independent explicit and regular clocks", () => {
    const [trace] = decodeAmbitTraces(createAmbitTrace());
    expect(trace.problems).toEqual([]);
    expect(trace.series).toEqual([
      {
        name: "fluo_630_signal",
        unit: "count",
        time: [0, 0.1, 0.2],
        values: [120, 160, 140],
        estimatedTime: false,
      },
      {
        name: "leaf_temp",
        unit: "Cel",
        time: [0.05, 0.25],
        values: [23.5, 23.7],
        estimatedTime: false,
      },
    ]);
  });

  it("extracts multiple traces from saved device envelopes, excluding scalar replies", () => {
    const data = {
      sample: [
        { set: [{ schema: "ambit.spectrum/1", v: [1, 2] }, createAmbitTrace()] },
        { set: [createAmbitTrace({ sensor_id: "second" })] },
      ],
    };
    const decoded = decodeAmbitTraces(JSON.parse(JSON.stringify(data)));
    expect(decoded).toHaveLength(2);
    expect(decoded[1].label).toContain("second");
    expect(decoded[0].series).toHaveLength(2);
  });

  it.each([
    (trace: unknown) => trace,
    (trace: unknown) => [trace],
    (trace: unknown) => ({ set: [trace] }),
    (trace: unknown) => ({ data: trace }),
    (trace: unknown) => ({ sample_raw: JSON.stringify([{ set: [trace] }]) }),
    (trace: unknown) => ({ sample_raw: [{ set: [trace] }] }),
  ])("recognizes supported wrappers", (wrap) => {
    const data = wrap(createAmbitTrace());
    expect(decodeAmbitTraces(data)[0].series).toHaveLength(2);
    expect(isMultispeqOutput(data)).toBe(false);
  });

  it.each([
    null,
    [1, 2],
    { series: { a: [1, 2] } },
    { schema: "ambit.device/1" },
    { metadata: createAmbitTrace() },
    { sample_raw: "not json" },
  ])("does not invent a trace for unrelated data", (data) => {
    expect(findAmbitTraces(data)).toEqual([]);
  });

  it("explains unsupported trace versions", () => {
    expect(decodeAmbitTraces(createAmbitTrace({ schema: "ambit.trace/4" }))[0]).toMatchObject({
      series: [],
      problems: [{ reason: "unsupported" }],
    });
  });

  it.each([
    { u: "count", v: [1, 2] },
    { u: "count", v: [1, 2], t: [0] },
    { u: "count", v: [1, 2], t: [0.2, 0.1] },
    { u: "count", v: [1, 2], t: [-1, 0] },
    { u: "count", v: [1, 2], t: [0, NaN] },
    { u: "count", v: [1, null], t: [0, 1] },
    { u: "count", v: [1, Infinity], t: [0, 1] },
    { u: "count", v: [1, 2], t0: 0, dt: 0 },
    { u: "count", v: [1, 2], t0: 0, dt: -1 },
    { u: "count", v: [1, 2], t: [], t0: 0, dt: 1 },
    { u: "", v: [1, 2], t0: 0, dt: 1 },
  ])("rejects malformed series without dropping or shifting individual points", (source) => {
    const [result] = decodeAmbitTraces(
      createAmbitTrace({ series: { bad: source, good: { u: "Cel", v: [-3.2], t: [0] } } }),
    );
    expect(result.series.map((s) => s.name)).toEqual(["good"]);
    expect(result.problems).toEqual([{ series: "bad", reason: "invalid" }]);
  });

  it("preserves estimated timing and irregular measured offsets", () => {
    const [trace] = decodeAmbitTraces(
      createAmbitTrace({
        series: { temperature: { u: "Cel", v: [20, 21, 19], t: [0, 0.02, 0.025], t_est: true } },
      }),
    );
    expect(trace.series[0]).toMatchObject({ time: [0, 0.02, 0.025], estimatedTime: true });
  });

  it("reports empty traces and bounds large series without silently truncating them", () => {
    expect(decodeAmbitTraces(createAmbitTrace({ series: {} }))[0].problems).toEqual([
      { reason: "empty" },
    ]);
    const large = { u: "count", t0: 0, dt: 0.001, v: Array.from({ length: 100_000 }, (_, i) => i) };
    expect(
      decodeAmbitTraces(createAmbitTrace({ series: { large } }))[0].series[0].values,
    ).toHaveLength(100_000);
    const over = { ...large, v: [...large.v, 1] };
    expect(decodeAmbitTraces(createAmbitTrace({ series: { over } }))[0].problems).toEqual([
      { series: "over", reason: "limit" },
    ]);
    const results = decodeAmbitTraces([
      createAmbitTrace({ series: { large } }),
      createAmbitTrace({ series: { large } }),
      createAmbitTrace({ series: { large } }),
    ]);
    expect(results[2].problems).toEqual([{ series: "large", reason: "limit" }]);
  });
});
