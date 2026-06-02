import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Histogram2D } from "../../charts/histogram-2d";

describe("Histogram2D", () => {
  it("renders without crashing in default heatmap mode", () => {
    const { container } = render(
      <Histogram2D data={[{ x: [1, 2, 3], y: [4, 5, 6], name: "s1" }]} />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders without crashing in contour mode with fill enabled", () => {
    const { container } = render(
      <Histogram2D
        data={[{ x: [1, 2, 3], y: [4, 5, 6], name: "s1" }]}
        renderMode="contour"
        contourFill
      />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });
});
