import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CorrelationMatrix } from "../../charts/correlation-matrix";

describe("CorrelationMatrix", () => {
  it("renders without crashing for a small symmetric matrix", () => {
    const { container } = render(
      <CorrelationMatrix
        correlationMatrix={[
          [1, 0.5],
          [0.5, 1],
        ]}
        labels={["x", "y"]}
      />,
    );
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders the loading slot when loading is set", () => {
    const { getByText } = render(
      <CorrelationMatrix correlationMatrix={[[1]]} labels={["x"]} loading />,
    );
    expect(getByText("Loading chart...")).toBeTruthy();
  });
});
