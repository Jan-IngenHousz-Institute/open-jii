import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GroupedBoxPlot } from "../../charts/grouped-box-plot";

describe("GroupedBoxPlot", () => {
  it("renders without crashing for a single group", () => {
    const { container } = render(
      <GroupedBoxPlot groups={[{ name: "A", values: [1, 2, 3, 4, 5] }]} />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders without crashing for multiple groups and explicit groupBy categories", () => {
    const { container } = render(
      <GroupedBoxPlot
        groups={[
          { name: "A", values: [1, 2, 3, 4] },
          { name: "B", values: [5, 6, 7, 8] },
        ]}
        groupBy={["q1", "q2"]}
      />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });
});
