import { describe, expect, it } from "vitest";

import { countInRange, m4Indices } from "./m4";

function series(length: number, y: (i: number) => number | null) {
  const xs = Array.from({ length }, (_, i) => i);
  const ys = xs.map(y);
  return { xs, ys };
}

describe("m4Indices", () => {
  it("keeps every point of a series that fits in four points per bucket", () => {
    const { xs, ys } = series(40, (i) => i);

    expect(m4Indices(xs, ys, [0, 39], 10)).toEqual(xs);
  });

  it("keeps each bucket's first, last, lowest and highest point, and so every spike", () => {
    const { xs, ys } = series(10_000, (i) => (i === 4_321 ? 1_000 : Math.sin(i / 50)));

    const picked = m4Indices(xs, ys, [0, 9_999], 100);

    expect(picked.length).toBeLessThanOrEqual(4 * 100 + 2);
    expect(picked).toContain(0);
    expect(picked).toContain(9_999);
    expect(picked).toContain(4_321);
    expect(picked).toEqual([...picked].sort((a, b) => a - b));
  });

  it("reduces only the visible range, plus one point beyond each edge", () => {
    const { xs, ys } = series(10_000, (i) => i % 7);

    const picked = m4Indices(xs, ys, [2_000.5, 2_999.5], 10);

    expect(picked[0]).toBe(2_000);
    expect(picked[picked.length - 1]).toBe(3_000);
    expect(picked.length).toBeLessThanOrEqual(4 * 10 + 2);
  });

  it("returns the visible slice whole once zoomed in far enough", () => {
    const { xs, ys } = series(10_000, (i) => i);

    expect(m4Indices(xs, ys, [100, 110], 10)).toEqual(xs.slice(99, 112));
  });

  it("keeps a missing value so the line keeps its gap", () => {
    const { xs, ys } = series(10_000, (i) => (i === 5_000 ? null : 1));

    expect(m4Indices(xs, ys, [0, 9_999], 10)).toContain(5_000);
  });

  it("leaves a series alone when its x does not ascend", () => {
    const xs = [3, 1, 2, ...Array.from({ length: 100 }, (_, i) => i + 4)];
    const ys = xs.map(() => 1);

    expect(m4Indices(xs, ys, [0, 200], 2)).toHaveLength(xs.length);
  });
});

describe("countInRange", () => {
  it("counts the points inside the range, edges included", () => {
    expect(countInRange([1, 2, 3, 4, 5], [2, 4])).toBe(3);
  });

  it("counts every point when the positions do not ascend", () => {
    expect(countInRange([3, 1, 2], [0, 1])).toBe(3);
  });
});
