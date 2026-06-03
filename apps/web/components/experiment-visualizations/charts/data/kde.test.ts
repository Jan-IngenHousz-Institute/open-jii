import { describe, expect, it } from "vitest";

import { computeKDE } from "./kde";

describe("computeKDE", () => {
  it("returns empty arrays and zero bandwidth on empty input", () => {
    const result = computeKDE([]);
    expect(result.xs).toEqual([]);
    expect(result.ys).toEqual([]);
    expect(result.bandwidth).toBe(0);
  });

  it("samples 200 points and keeps xs strictly increasing", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = computeKDE(values);
    expect(result.xs).toHaveLength(200);
    expect(result.ys).toHaveLength(200);
    for (let i = 1; i < result.xs.length; i++) {
      expect(result.xs[i]).toBeGreaterThan(result.xs[i - 1]);
    }
  });

  it("pads the x range past the data extremes by 2 bandwidths", () => {
    const values = [0, 1, 2, 3, 4, 5];
    const result = computeKDE(values);
    const pad = 2 * result.bandwidth;
    expect(result.xs[0]).toBeCloseTo(Math.min(...values) - pad, 9);
    expect(result.xs[result.xs.length - 1]).toBeCloseTo(Math.max(...values) + pad, 9);
  });

  it("uses Silverman's rule for bandwidth: 1.06 * std * n^(-1/5)", () => {
    const values = [1, 2, 3, 4, 5];
    const mean = 3;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const expected = 1.06 * Math.sqrt(variance) * Math.pow(values.length, -1 / 5);
    const result = computeKDE(values);
    expect(result.bandwidth).toBeCloseTo(expected, 9);
  });

  it("clamps bandwidth to a positive epsilon when std is zero", () => {
    const result = computeKDE([7, 7, 7, 7]);
    expect(result.bandwidth).toBeGreaterThan(0);
    expect(result.bandwidth).toBeLessThan(1e-6);
  });

  it("places the PDF peak near the mean of a roughly symmetric sample", () => {
    const values = [-2, -1, 0, 0, 0, 1, 2];
    const result = computeKDE(values);
    let peakIdx = 0;
    for (let i = 1; i < result.ys.length; i++) {
      if (result.ys[i] > result.ys[peakIdx]) peakIdx = i;
    }
    expect(result.xs[peakIdx]).toBeGreaterThan(-1);
    expect(result.xs[peakIdx]).toBeLessThan(1);
  });

  it("honours an explicit fixedRange so curves can share a grid", () => {
    const result = computeKDE([1, 2, 3], false, [-10, 10]);
    expect(result.xs[0]).toBe(-10);
    expect(result.xs[result.xs.length - 1]).toBe(10);
  });

  it("produces a monotonically non-decreasing CDF when cumulative=true", () => {
    const result = computeKDE([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], true);
    expect(result.ys[0]).toBe(0);
    for (let i = 1; i < result.ys.length; i++) {
      expect(result.ys[i]).toBeGreaterThanOrEqual(result.ys[i - 1]);
    }
  });

  it("CDF asymptotes near 1 at the right edge for a well-supported distribution", () => {
    const values = Array.from({ length: 100 }, (_, i) => (i - 49.5) / 10);
    const result = computeKDE(values, true);
    const last = result.ys[result.ys.length - 1];
    expect(last).toBeGreaterThan(0.95);
    expect(last).toBeLessThan(1.05);
  });

  it("PDF integrates to ~1 via trapezoidal rule on a moderate Gaussian sample", () => {
    const values = Array.from({ length: 200 }, (_, i) => (i - 99.5) / 20);
    const result = computeKDE(values);
    const step = result.xs[1] - result.xs[0];
    let area = 0;
    for (let i = 1; i < result.ys.length; i++) {
      area += ((result.ys[i] + result.ys[i - 1]) / 2) * step;
    }
    expect(area).toBeGreaterThan(0.95);
    expect(area).toBeLessThan(1.05);
  });
});
