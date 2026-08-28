import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { PlatformStatChips } from "./platform-stat-chips";

const { mockPublicMetrics, mockMine } = vi.hoisted(() => ({
  mockPublicMetrics: vi.fn(),
  mockMine: vi.fn(),
}));

vi.mock("@/hooks/metrics/usePublicMetrics/usePublicMetrics", () => ({
  usePublicMetrics: mockPublicMetrics,
}));
vi.mock("@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics", () => ({
  useMyScopedMetrics: mockMine,
}));

describe("PlatformStatChips", () => {
  it("renders the windowed chips including the personal count", () => {
    mockPublicMetrics.mockReturnValue({
      data: {
        liveness: { lastMeasurementAt: "2026-08-28 10:00:00", measurements24h: 1_428 },
        community: {
          measurements30d: 4_812,
          activeExperiments30d: 23,
          contributors30d: 31,
          institutions30d: 9,
        },
      },
    });
    mockMine.mockReturnValue({ data: { scoped: { measurements30d: 340 } } });

    render(<PlatformStatChips locale="en-US" />);

    expect(screen.getByText("dashboard.chips.month.label")).toBeInTheDocument();
    expect(screen.getByText("4,812")).toBeInTheDocument();
    expect(screen.getByText("1,428")).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
  });

  it("omits the personal chip when the scoped fetch has no data", () => {
    mockPublicMetrics.mockReturnValue({
      data: {
        liveness: { lastMeasurementAt: null, measurements24h: 10 },
        community: {
          measurements30d: 20,
          activeExperiments30d: 2,
          contributors30d: 1,
          institutions30d: 1,
        },
      },
    });
    mockMine.mockReturnValue({ data: undefined });

    render(<PlatformStatChips locale="en-US" />);

    expect(screen.queryByText("dashboard.chips.mine.label")).not.toBeInTheDocument();
  });

  it("renders nothing while the public snapshot is unavailable", () => {
    mockPublicMetrics.mockReturnValue({ data: undefined });
    mockMine.mockReturnValue({ data: undefined });

    const { container } = render(<PlatformStatChips locale="en-US" />);

    expect(container).toBeEmptyDOMElement();
  });
});
