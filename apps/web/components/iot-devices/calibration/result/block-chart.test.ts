import { describe, expect, it } from "vitest";

import { blockChart } from "./block-chart";

const CHART = {
  x: "par_raw",
  y: "par_ref",
  points: [
    [10.46, 94.17],
    [6.98, 58.53],
  ],
};

describe("blockChart", () => {
  it("draws the pairs the script fitted, under the line its coefficients describe", () => {
    const chart = blockChart({
      status: "computed",
      coefficients: { slope: 8.9143, intercept: -0.92 },
      quality: { passed: true, chart: CHART },
    });

    expect(chart).toEqual({
      kind: "fit",
      x: "par_raw",
      y: "par_ref",
      points: [
        { x: 10.46, y: 94.17 },
        { x: 6.98, y: 58.53 },
      ],
      line: { slope: 8.9143, intercept: -0.92 },
    });
  });

  // A gain is a line through the origin; the Ambit's two blocks each carry one.
  it("reads a lone gain as a line through the origin", () => {
    const chart = blockChart({
      status: "computed",
      coefficients: { spec: 1.1893 },
      quality: { passed: true, chart: { x: "par", y: "par_ref", points: [[160, 190.29]] } },
    });

    expect(chart).toMatchObject({ kind: "fit", line: { slope: 1.1893, intercept: 0 } });
  });

  // The points stand on their own: a rejected fit is exactly the one worth looking at.
  it("keeps the points when the coefficients describe no line", () => {
    const chart = blockChart({
      status: "rejected",
      reason: "out of range",
      quality: { passed: false, chart: CHART },
    });

    expect(chart).toMatchObject({ kind: "fit", line: null });
  });

  it("draws a vector coefficient as one bar per element", () => {
    const chart = blockChart({
      status: "computed",
      coefficients: { channels: [312, 198, 245, 187, 203, 176] },
      quality: { passed: true },
    });

    expect(chart).toEqual({
      kind: "vector",
      name: "channels",
      values: [312, 198, 245, 187, 203, 176],
    });
  });

  it("shows nothing for a block that is neither fitted nor a vector", () => {
    expect(
      blockChart({
        status: "computed",
        coefficients: { slope: 1, intercept: 0.5 },
        quality: { passed: true },
      }),
    ).toBeNull();
    expect(blockChart({ status: "skipped" })).toBeNull();
  });

  // The record is free-form, so what it holds is checked rather than trusted.
  it("ignores a chart record that is not points", () => {
    expect(
      blockChart({
        status: "computed",
        coefficients: { slope: 1 },
        quality: { chart: { x: "a", y: "b", points: ["nonsense", [1]] } },
      }),
    ).toBeNull();
    expect(
      blockChart({
        status: "computed",
        coefficients: { slope: 1 },
        quality: { chart: { points: [[1, 2]] } },
      }),
    ).toBeNull();
  });
});
