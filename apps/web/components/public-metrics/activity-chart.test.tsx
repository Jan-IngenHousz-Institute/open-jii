import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { MetricsActivityDay } from "@repo/api/domains/metrics/metrics.schema";

import { ActivityChart } from "./activity-chart";

const barProps: Record<string, unknown>[] = [];

vi.mock("@repo/ui/components/charts/bar-chart", () => ({
  BarChart: (props: Record<string, unknown>) => {
    barProps.push(props);
    return <div data-testid="bar-chart" />;
  },
}));

const data: MetricsActivityDay[] = [
  { date: "2026-08-27", measurements: 20, cumulativeMeasurements: 980, volumeBytes: 400_000 },
  { date: "2026-08-28", measurements: 20, cumulativeMeasurements: 1_000, volumeBytes: 400_000 },
];

describe("ActivityChart", () => {
  it("plots dates on a date axis, without plotly chrome", () => {
    barProps.length = 0;
    render(<ActivityChart data={data} locale="en-US" />);

    const config = barProps[0]?.config as Record<string, unknown>;
    // A linear axis silently drops date-string bars: the chart renders empty.
    expect(config.xAxisType).toBe("date");
    expect(config.showModeBar).toBe(false);
    expect(config.backgroundColor).toBe("rgba(0,0,0,0)");

    const series = (barProps[0]?.data as { x: string[]; y: number[] }[])[0];
    expect(series.x).toEqual(["2026-08-27", "2026-08-28"]);
    expect(series.y).toEqual([20, 20]);
  });

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
  });
});
