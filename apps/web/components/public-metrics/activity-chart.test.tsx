import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { MetricsActivityDay } from "@repo/api/domains/metrics/metrics.schema";

import { ActivityChart } from "./activity-chart";

/** What the mocked chart component was handed. */
interface CapturedChart {
  config: Record<string, unknown>;
  data: { x: string[]; y: number[]; name: string }[];
}

const barProps: CapturedChart[] = [];

vi.mock("@repo/ui/components/charts/bar-chart", () => ({
  BarChart: (props: CapturedChart) => {
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

    const [captured] = barProps;
    // A linear axis silently drops date-string bars: the chart renders empty.
    expect(captured.config.xAxisType).toBe("date");
    expect(captured.config.showModeBar).toBe(false);
    expect(captured.config.backgroundColor).toBe("rgba(0,0,0,0)");

    const [series] = captured.data;
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
