import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { ExperimentActivityPulse } from "./experiment-activity-pulse";

const { mockExperimentMetrics, areaProps } = vi.hoisted(() => ({
  mockExperimentMetrics: vi.fn(),
  areaProps: [] as Record<string, unknown>[],
}));

vi.mock("~/hooks/metrics/useExperimentMetrics/useExperimentMetrics", () => ({
  useExperimentMetrics: mockExperimentMetrics,
}));
vi.mock("@repo/ui/components/charts/area-chart", () => ({
  AreaChart: (props: Record<string, unknown>) => {
    areaProps.push(props);
    return <div data-testid="trend" />;
  },
}));

const activity = [
  { date: "2026-08-27", measurements: 40 },
  { date: "2026-08-28", measurements: 62 },
];

describe("ExperimentActivityPulse", () => {
  it("reports what this experiment collected, with its trend", () => {
    areaProps.length = 0;
    mockExperimentMetrics.mockReturnValue({
      data: {
        scoped: {
          measurements30d: 102,
          activeExperiments30d: 1,
          contributors30d: 2,
          activity,
          lastActivityDate: "2026-08-28",
        },
      },
    });

    render(<ExperimentActivityPulse experimentId="e1" />);

    expect(screen.getByText("experiment.collecting")).toBeInTheDocument();
    const series = (areaProps[0]?.data as { y: number[] }[])[0];
    expect(series.y).toEqual([40, 62]);
  });

  it("says so plainly when nothing was recorded", () => {
    mockExperimentMetrics.mockReturnValue({
      data: {
        scoped: {
          measurements30d: 0,
          activeExperiments30d: 0,
          contributors30d: 0,
          activity: [],
          lastActivityDate: null,
        },
      },
    });

    render(<ExperimentActivityPulse experimentId="e1" />);

    expect(screen.getByText("experiment.quiet")).toBeInTheDocument();
    expect(screen.queryByTestId("trend")).not.toBeInTheDocument();
  });

  it("renders nothing while the warehouse has no snapshot", () => {
    mockExperimentMetrics.mockReturnValue({ data: { scoped: null } });

    const { container } = render(<ExperimentActivityPulse experimentId="e1" />);

    expect(container).toBeEmptyDOMElement();
  });
});
