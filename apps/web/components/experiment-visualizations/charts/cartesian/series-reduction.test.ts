import { describe, expect, it } from "vitest";

import type { CartesianSeries } from "@repo/ui/components/charts/cartesian-chart";

import {
  axisPosition,
  MARKER_POINT_LIMIT,
  REDUCTION_BUCKETS,
  reduceSeries,
} from "./series-reduction";

const LENGTH = 4 * REDUCTION_BUCKETS * 3;

function lineSeries(overrides: Partial<CartesianSeries> = {}): CartesianSeries {
  const x = Array.from({ length: LENGTH }, (_, i) => i);
  return {
    traceType: "line",
    x,
    y: x.map((i) => (i === 7_777 ? 500 : Math.sin(i / 40))),
    error_y: { type: "data", array: x.map((i) => i / 10), visible: true },
    ...overrides,
  };
}

function positionsOf(series: CartesianSeries[]) {
  return series.map((one) => one.x.map(axisPosition));
}

describe("reduceSeries", () => {
  it("thins a long line to the visible range and keeps its error bars on the right points", () => {
    const series = [lineSeries()];

    const { series: reduced, isReduced } = reduceSeries(
      series,
      positionsOf(series),
      () => undefined,
    );

    const [line] = reduced;
    expect(isReduced).toBe(true);
    expect(line.x.length).toBeLessThanOrEqual(4 * REDUCTION_BUCKETS + 2);
    expect(line.y).toContain(500);
    line.x.forEach((x, i) => expect(line.error_y?.array?.[i]).toBe(Number(x) / 10));
  });

  it("follows the axis's zoom", () => {
    const series = [lineSeries()];

    const { series: reduced } = reduceSeries(series, positionsOf(series), () => [1_000, 1_100]);

    expect(reduced[0].x[0]).toBe(999);
    expect(reduced[0].x[reduced[0].x.length - 1]).toBe(1_101);
  });

  it("leaves short lines, stacked areas, scatter and bars whole", () => {
    const series = [
      lineSeries({ x: [1, 2, 3], y: [1, 2, 3], error_y: undefined }),
      lineSeries({ traceType: "area", stackgroup: "stack-primary" }),
      lineSeries({ traceType: "scatter" }),
      lineSeries({ traceType: "bar" }),
    ];

    const { series: reduced, isReduced } = reduceSeries(
      series,
      positionsOf(series),
      () => undefined,
    );

    expect(isReduced).toBe(false);
    expect(reduced).toEqual(series);
  });

  it("shares one bucket budget across a chart's lines, so ten lines draw no more than one", () => {
    const series = Array.from({ length: 10 }, () =>
      lineSeries({
        x: Array.from({ length: 5_900 }, (_, i) => i),
        y: Array.from({ length: 5_900 }, (_, i) => Math.sin(i)),
        error_y: undefined,
      }),
    );

    const { series: reduced, isReduced } = reduceSeries(
      series,
      positionsOf(series),
      () => undefined,
    );

    expect(isReduced).toBe(true);
    const drawn = reduced.reduce((sum, one) => sum + one.x.length, 0);
    expect(drawn).toBeLessThanOrEqual(10 * (4 * 200 + 2));
  });

  it("drops the markers once the lines show more points than markers can mark, and says so", () => {
    const x = Array.from({ length: MARKER_POINT_LIMIT + 500 }, (_, i) => i);
    const series = [lineSeries({ x, y: x, mode: "lines+markers", error_y: undefined })];

    const { series: reduced, isReduced } = reduceSeries(
      series,
      positionsOf(series),
      () => undefined,
    );

    expect(reduced[0].mode).toBe("lines");
    expect(reduced[0].x).toHaveLength(x.length);
    expect(isReduced).toBe(true);
  });

  it("keeps the markers once a zoom narrows the view to few enough points", () => {
    const x = Array.from({ length: MARKER_POINT_LIMIT + 500 }, (_, i) => i);
    const series = [lineSeries({ x, y: x, mode: "lines+markers", error_y: undefined })];

    const { series: reduced, isReduced } = reduceSeries(series, positionsOf(series), () => [
      100, 600,
    ]);

    expect(reduced[0].mode).toBe("lines+markers");
    expect(isReduced).toBe(false);
  });

  it("leaves a scatter's markers alone however many there are", () => {
    const x = Array.from({ length: MARKER_POINT_LIMIT * 3 }, (_, i) => i);
    const series = [
      lineSeries({ traceType: "scatter", x, y: x, mode: "markers", error_y: undefined }),
    ];

    const { series: reduced } = reduceSeries(series, positionsOf(series), () => undefined);

    expect(reduced[0].mode).toBe("markers");
  });

  it("orders ISO timestamps by their time", () => {
    expect(axisPosition("2026-09-25T12:00:00.000Z")).toBe(Date.UTC(2026, 8, 25, 12));
    expect(axisPosition("site-a")).toBeNaN();
  });

  it("reads a numeric string, as the API sends every cell, as a number rather than a date", () => {
    expect(axisPosition("12.5")).toBe(12.5);
    expect(axisPosition("-3")).toBe(-3);
  });
});
