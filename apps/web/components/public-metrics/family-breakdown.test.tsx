import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { FamilyBreakdown } from "./family-breakdown";

const families = [
  {
    family: "multispeq",
    totalMeasurements: 1000,
    devicesAllTime: 7,
    devicesActive7d: 3,
    lastMeasurementAt: "2026-08-14 10:00:00",
  },
  {
    family: "ambyte",
    totalMeasurements: 250,
    devicesAllTime: 2,
    devicesActive7d: 1,
    lastMeasurementAt: null,
  },
];

describe("FamilyBreakdown", () => {
  it("scales bars relative to the largest family", () => {
    const { container } = render(<FamilyBreakdown families={families} locale="en-US" />);

    const bars = container.querySelectorAll("li span[style]");
    expect(bars).toHaveLength(2);
    expect(bars[0].getAttribute("style")).toContain("width: 100%");
    expect(bars[1].getAttribute("style")).toContain("width: 25%");
  });

  it("labels families and formats counts compactly", () => {
    render(<FamilyBreakdown families={families} locale="en-US" />);

    expect(screen.getByText("multispeq")).toBeInTheDocument();
    expect(screen.getByText("ambyte")).toBeInTheDocument();
    expect(screen.getByText("1K")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });
});
