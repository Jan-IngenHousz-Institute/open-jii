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
        change={0.184}
      />,
    );

    expect(screen.getByText("+18%")).toBeInTheDocument();
    expect(screen.getByText("9.5M")).toHaveAttribute("title", "9,469,959");
  });

  it("signs a fall", () => {
    render(<MetricStatCard locale="en-US" label="Measurements" value="120" change={-0.32} />);

    expect(screen.getByText("-32%")).toBeInTheDocument();
  });

  it("shows no badge when there is nothing to compare against", () => {
    render(
      <MetricStatCard
        locale="en-US"
        label="Protocols in use"
        value="13"
        note="of 27 you can access"
        context="Last 30 days"
      />,
    );

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByText("of 27 you can access")).toBeInTheDocument();
  });
});
