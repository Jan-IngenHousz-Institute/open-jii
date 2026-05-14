import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ViolinPlot } from "../../charts/violin-plot";

describe("ViolinPlot", () => {
  it("renders without crashing for a single series", () => {
    const { container } = render(
      <ViolinPlot data={[{ name: "A", y: [1, 2, 3, 4, 5, 6, 7] }]} />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders the error slot when an error prop is set", () => {
    const { getByText } = render(<ViolinPlot data={[]} error="boom" />);
    expect(getByText("boom")).toBeTruthy();
  });
});
