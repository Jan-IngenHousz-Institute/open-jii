import { describe, expect, it } from "vitest";

import { sparklinePath } from "./sparkline-path";

const BOX = { width: 80, height: 24, padding: 2 };

function drawnPoints(path: string) {
  return path
    .replace("M ", "")
    .split(" L ")
    .map((point) => point.split(",").map(Number));
}

describe("sparklinePath", () => {
  it("keeps every point of a short series", () => {
    expect(drawnPoints(sparklinePath([1, 3, 2], BOX))).toEqual([
      [2, 22],
      [40, 2],
      [78, 12],
    ]);
  });

  it("draws a long series with at most two points per pixel column, spikes included", () => {
    const data = Array.from({ length: 20_000 }, (_, index) => Math.sin(index / 50));
    data[12_345] = 10;
    data[6_789] = -10;

    const points = drawnPoints(sparklinePath(data, BOX));
    const ys = points.map(([, y]) => y);

    expect(points.length).toBeLessThanOrEqual(2 * 77);
    expect(Math.min(...ys)).toBe(2);
    expect(Math.max(...ys)).toBe(22);
  });
});
