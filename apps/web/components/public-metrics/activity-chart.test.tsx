import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { MetricsActivityDay } from "@repo/api/domains/metrics/metrics.schema";

import { ActivityChart } from "./activity-chart";

const data: MetricsActivityDay[] = [
  { date: "2026-08-27", measurements: 20, cumulativeMeasurements: 980, volumeBytes: 400_000 },
  { date: "2026-08-28", measurements: 20, cumulativeMeasurements: 1_000, volumeBytes: 400_000 },
];

describe("ActivityChart", () => {
  it("defaults to the daily measure", () => {
    render(<ActivityChart data={data} locale="en-US" />);

    expect(screen.getByText("activityChart.title.daily")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "activityChart.daily" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches measure via the toggle", async () => {
    render(<ActivityChart data={data} locale="en-US" />);

    await userEvent.click(screen.getByRole("button", { name: "activityChart.cumulative" }));
    expect(screen.getByText("activityChart.title.cumulative")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "activityChart.volume" }));
    expect(screen.getByText("activityChart.title.volume")).toBeInTheDocument();
  });
});
