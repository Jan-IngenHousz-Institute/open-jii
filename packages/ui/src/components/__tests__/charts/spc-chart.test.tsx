import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SPCChart } from "../../charts/spc-chart";

describe("SPCChart", () => {
  it("renders without crashing for an in-control series", () => {
    const { container } = render(
      <SPCChart
        x={[1, 2, 3, 4, 5]}
        y={[10, 11, 9, 12, 10]}
        cl={10.4}
        ucl={14}
        lcl={6.8}
        outOfControlIndices={[]}
      />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders without crashing with a warning band and an out-of-control marker", () => {
    const { container } = render(
      <SPCChart
        x={[1, 2, 3]}
        y={[10, 30, 10]}
        cl={10}
        ucl={20}
        lcl={0}
        warningUpper={15}
        warningLower={5}
        outOfControlIndices={[1]}
      />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });
});
