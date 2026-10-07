import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { Sparkline } from "./output-cell-charts";

function drawnPoints(container: HTMLElement) {
  const path = container.querySelector("path")?.getAttribute("d") ?? "";
  return path
    .replace("M ", "")
    .split(" L ")
    .map((point) => point.split(",").map(Number));
}

describe("Sparkline", () => {
  it("keeps every point of a short series", () => {
    const { container } = render(<Sparkline data={[1, 3, 2]} columnName="spectrum" />);

    expect(drawnPoints(container)).toEqual([
      [2, 22],
      [40, 2],
      [78, 12],
    ]);
  });

  it("draws a long series with at most two points per pixel column, spikes included", () => {
    const data = Array.from({ length: 20_000 }, (_, index) => Math.sin(index / 50));
    data[12_345] = 10;
    data[6_789] = -10;

    const { container } = render(<Sparkline data={data} columnName="spectrum" />);
    const points = drawnPoints(container);
    const ys = points.map(([, y]) => y);

    expect(points.length).toBeLessThanOrEqual(2 * 77);
    expect(Math.min(...ys)).toBe(2);
    expect(Math.max(...ys)).toBe(22);
  });
});
