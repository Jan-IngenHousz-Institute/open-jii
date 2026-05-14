import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DensityPlot2D } from "../../charts/density-plot-2d";

describe("DensityPlot2D", () => {
  it("renders without crashing for non-empty x/y", () => {
    const { container } = render(<DensityPlot2D x={[1, 2, 3]} y={[10, 20, 30]} />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders without crashing for empty x/y (no contour layer)", () => {
    const { container } = render(<DensityPlot2D x={[]} y={[]} />);
    expect(container.querySelector("div")).toBeTruthy();
  });
});
