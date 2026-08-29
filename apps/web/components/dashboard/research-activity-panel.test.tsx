import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { ResearchActivityPanel } from "./research-activity-panel";

const { mockPublicMetrics, mockMine, areaProps } = vi.hoisted(() => ({
  mockPublicMetrics: vi.fn(),
  mockMine: vi.fn(),
  areaProps: [] as Record<string, unknown>[],
}));

vi.mock("@/hooks/metrics/usePublicMetrics/usePublicMetrics", () => ({
  usePublicMetrics: mockPublicMetrics,
}));
vi.mock("@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics", () => ({
  useMyScopedMetrics: mockMine,
}));
vi.mock("@repo/ui/components/charts/area-chart", () => ({
  AreaChart: (props: Record<string, unknown>) => {
    areaProps.push(props);
    return <div data-testid="trend" />;
  },
}));

const scoped = {
  measurements30d: 4_120,
  activeExperiments30d: 3,
  contributors30d: 5,
  activity: [
    { date: "2026-08-27", measurements: 2_000 },
    { date: "2026-08-28", measurements: 2_120 },
  ],
  lastActivityDate: "2026-08-28",
};

describe("ResearchActivityPanel", () => {
  it("leads with the reader's own activity and plots its trend", () => {
    areaProps.length = 0;
    mockMine.mockReturnValue({ data: { scoped } });
    mockPublicMetrics.mockReturnValue({
      data: { community: { measurements30d: 18_883_130 } },
    });

    render(<ResearchActivityPanel locale="en-US" />);

    expect(screen.getByText("4,120")).toBeInTheDocument();
    expect(screen.getByText("dashboard.activity.label")).toBeInTheDocument();
    expect(screen.getByText("dashboard.activity.experiments")).toBeInTheDocument();
    expect(screen.getByText("dashboard.activity.contributors")).toBeInTheDocument();
    expect(screen.getByText("dashboard.activity.context")).toBeInTheDocument();

    const series = (areaProps[0]?.data as { y: number[] }[])[0];
    expect(series.y).toEqual([2_000, 2_120]);
  });

  it("omits the trend when a single day cannot show one", () => {
    areaProps.length = 0;
    mockMine.mockReturnValue({
      data: { scoped: { ...scoped, activity: [{ date: "2026-08-28", measurements: 12 }] } },
    });
    mockPublicMetrics.mockReturnValue({ data: { community: null } });

    render(<ResearchActivityPanel locale="en-US" />);

    expect(screen.queryByTestId("trend")).not.toBeInTheDocument();
    expect(screen.queryByText("dashboard.activity.context")).not.toBeInTheDocument();
  });

  it("renders nothing without a scoped snapshot", () => {
    mockMine.mockReturnValue({ data: undefined });
    mockPublicMetrics.mockReturnValue({ data: undefined });

    const { container } = render(<ResearchActivityPanel locale="en-US" />);

    expect(container).toBeEmptyDOMElement();
  });
});
