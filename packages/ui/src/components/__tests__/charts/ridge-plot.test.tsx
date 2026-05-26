import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RidgePlot } from "../../charts/ridge-plot";

describe("RidgePlot", () => {
  it("renders without crashing given a single pre-computed ridge", () => {
    const { container } = render(
      <RidgePlot
        data={[
          {
            name: "ridge-1",
            xs: [0, 1, 2, 3],
            ys: [0, 0.5, 0.8, 0.2],
            laneBaseY: 0,
            color: "#636EFA",
          },
        ]}
        categoryTicks={[{ value: 0, label: "ridge-1" }]}
      />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders the loading slot when loading is set", () => {
    const { getByText } = render(<RidgePlot data={[]} categoryTicks={[]} loading />);
    expect(getByText("Loading chart...")).toBeTruthy();
  });
});
