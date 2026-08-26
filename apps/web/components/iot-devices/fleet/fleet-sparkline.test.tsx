import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { FleetSparkline } from "./fleet-sparkline";

describe("FleetSparkline", () => {
  it("draws an area, a line, and an emphasized last point", () => {
    const { container } = render(<FleetSparkline values={[1, 4, 2, 6]} />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(container.querySelectorAll("path")).toHaveLength(2);
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("renders nothing for a single bucket", () => {
    const { container } = render(<FleetSparkline values={[7]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when every bucket is zero", () => {
    const { container } = render(<FleetSparkline values={[0, 0, 0]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
