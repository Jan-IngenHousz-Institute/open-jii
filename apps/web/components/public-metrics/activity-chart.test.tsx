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

// The chart states a window of calendar days, so the fixture is anchored to
// today rather than to dates that would age out of it.
const dayAt = (offset: number) =>
  new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const data: MetricsActivityDay[] = [
  { date: dayAt(1), measurements: 20, cumulativeMeasurements: 980, volumeBytes: 400_000 },
  { date: dayAt(0), measurements: 20, cumulativeMeasurements: 1_000, volumeBytes: 400_000 },
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
    // Thirty calendar days, not thirty rows: the warehouse writes only the days
    // that recorded something.
    expect(series.x).toHaveLength(30);
    expect(series.x[29]).toBe(dayAt(0));
    expect(series.x[0]).toBe(dayAt(29));
    expect(series.y.slice(-2)).toEqual([20, 20]);
    expect(series.y.slice(0, 28).every((value) => value === 0)).toBe(true);
  });

  it("leaves out days older than the window it names", () => {
    barProps.length = 0;
    render(
      <ActivityChart
        data={[
          { date: dayAt(200), measurements: 999, cumulativeMeasurements: 1, volumeBytes: 1 },
          ...data,
        ]}
        locale="en-US"
      />,
    );

    const [captured] = barProps;
    const [series] = captured.data;
    expect(series.x).toHaveLength(30);
    expect(series.y).not.toContain(999);
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
