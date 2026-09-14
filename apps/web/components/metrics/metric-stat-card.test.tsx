import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { MetricStatCard } from "./metric-stat-card";

describe("MetricStatCard", () => {
  it("signs a rise and keeps the exact figure behind the abbreviation", () => {
    render(
      <MetricStatCard
        locale="en-US"
        label="Measurements"
        value="9.5M"
        title="9,469,959"
        comparison={{ current: 9_469_959, previous: 8_000_000 }}
      />,
    );

    expect(screen.getByText("+18%")).toBeInTheDocument();
    // The abbreviation is what shows; the exact figure is on hover.
    expect(screen.getByTitle("9,469,959")).toHaveTextContent("9.5M");
  });

  it("signs a fall", () => {
    render(
      <MetricStatCard
        locale="en-US"
        label="Measurements"
        value="120"
        comparison={{ current: 120, previous: 176 }}
      />,
    );

    expect(screen.getByText("-32%")).toBeInTheDocument();
  });

  it("drops the badge when the base is too small for a percentage to mean anything", () => {
    render(
      <MetricStatCard
        locale="en-US"
        label="Measurements"
        value="18K"
        comparison={{ current: 18_000, previous: 9 }}
        note="9 in the previous 30 days"
      />,
    );

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    // The reader still gets the comparison, as the two figures themselves.
    expect(screen.getByText("9 in the previous 30 days")).toBeInTheDocument();
  });

  it("shows no badge when nothing was recorded to compare against", () => {
    render(
      <MetricStatCard
        locale="en-US"
        label="Protocols in use"
        value="13"
        comparison={{ current: 13, previous: 0 }}
        note="of 27 you can access"
        context="Last 30 days"
      />,
    );

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByText("of 27 you can access")).toBeInTheDocument();
  });
});
