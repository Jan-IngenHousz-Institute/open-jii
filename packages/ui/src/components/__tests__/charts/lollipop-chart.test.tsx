import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LollipopChart } from "../../charts/lollipop-chart";

describe("LollipopChart", () => {
  it("renders without crashing for vertical orientation", () => {
    const { container } = render(
      <LollipopChart categories={["A", "B", "C"]} values={[1, 2, 3]} />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders without crashing for horizontal orientation with error bars", () => {
    const { container } = render(
      <LollipopChart
        categories={["A", "B"]}
        values={[1, 2]}
        errors={[0.1, 0.2]}
        orientation="h"
      />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });
});
