import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ResourceMetricsCell } from "./resource-metrics-cell";

const activity = {
  measurements: 105,
  days: [
    { date: "2026-08-26", measurements: 0 },
    { date: "2026-08-27", measurements: 5 },
    { date: "2026-08-28", measurements: 100 },
  ],
};

describe("ResourceMetricsCell", () => {
  it("draws the series its row already carried", () => {
    const { container } = render(
      <ResourceMetricsCell activity={activity} windowDays={30} kind="macro" />,
    );

    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(screen.getByRole("img")).toHaveAccessibleName("resourceMetrics.strip");
  });

  it("leaves the cell empty for a row that recorded nothing", () => {
    const { container } = render(
      <ResourceMetricsCell activity={null} windowDays={30} kind="protocol" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
