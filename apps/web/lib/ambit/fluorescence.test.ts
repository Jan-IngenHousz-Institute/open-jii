import { describe, expect, it } from "vitest";

import { deriveFluorescence } from "./fluorescence";
import { decodeAmbitTraces } from "./timeseries";

function channels(reference = [100, 200, 400], time = [0, 0.1, 0.4]) {
  return decodeAmbitTraces({
    schema: "ambit.trace/3",
    series: {
      fluo_630_signal: { u: "count", t: [0, 0.1, 0.4], v: [10, 60, 80] },
      fluo_630_ref: { u: "count", t: time, v: reference },
    },
  })[0].series;
}

describe("Ambit fluorescence presentation", () => {
  it("shows the reference-corrected fluorescence at measured times without changing raw data", () => {
    const raw = channels();
    expect(deriveFluorescence(raw)).toMatchObject({
      status: "available",
      filledReferences: 0,
      series: { unit: "ratio", time: [0, 0.1, 0.4], values: [0.1, 0.3, 0.2] },
    });
    expect(raw[0].values).toEqual([10, 60, 80]);
    expect(raw[1].values).toEqual([100, 200, 400]);
  });

  it("uses the measured reference mean for zero references and reports the substitution", () => {
    expect(deriveFluorescence(channels([100, 0, 300]))).toMatchObject({
      status: "available",
      filledReferences: 1,
      series: { values: [0.1, 0.3, 80 / 300] },
    });
  });

  it("does not align channels by array position when their clocks differ", () => {
    expect(deriveFluorescence(channels([100, 200, 400], [0, 0.2, 0.4]))).toEqual({
      status: "unaligned",
    });
  });

  it.each([{ values: [0, 0, 0] }, { values: [-1, 2, 3] }])(
    "does not derive a ratio from unusable references",
    ({ values }) => {
      expect(deriveFluorescence(channels(values))).toEqual({ status: "invalid" });
    },
  );

  it("keeps missing and different-length reference channels out of the ratio", () => {
    expect(deriveFluorescence(channels().slice(0, 1))).toEqual({ status: "missing" });
    expect(deriveFluorescence(channels([100, 200], [0, 0.1]))).toEqual({ status: "unaligned" });
  });

  it("does not mix non-count units and propagates estimated timing", () => {
    const raw = channels();
    raw[1].unit = "Cel";
    expect(deriveFluorescence(raw)).toEqual({ status: "invalid" });
    raw[1].unit = "count";
    raw[1].estimatedTime = true;
    expect(deriveFluorescence(raw)).toMatchObject({
      status: "available",
      series: { estimatedTime: true },
    });
  });
});
