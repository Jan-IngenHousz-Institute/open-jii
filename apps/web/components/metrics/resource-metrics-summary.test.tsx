import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ResourceMetricsSummary } from "./resource-metrics-summary";

const WINDOW_DAYS = 30;

// The window slides, so the fixture is anchored to today rather than to a date
// that would drift out of range.
const dayAt = (offset: number) =>
  new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const days = Array.from({ length: WINDOW_DAYS }, (_, index) => ({
  date: dayAt(WINDOW_DAYS - 1 - index),
  measurements: index === WINDOW_DAYS - 10 ? 3_000 : 100,
}));

const metrics = {
  kind: "protocol" as const,
  totalMeasurements: 5_900,
  previousMeasurements: 4_000,
  activeCount: 3,
  visibleCount: 12,
  activeDays: WINDOW_DAYS,
  peak: { date: dayAt(9), measurements: 3_000 },
  lastActivityDate: dayAt(0),
  days,
  windowDays: WINDOW_DAYS,
};

describe("ResourceMetricsSummary", () => {
  it("states what the reader's own resources recorded", async () => {
    server.mount(contract.metrics.getResourceMetrics, { body: metrics });

    render(<ResourceMetricsSummary kind="protocol" />);

    expect(await screen.findByText("5.9K")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("resourceMetrics.protocol.active")).toBeInTheDocument();
    expect(screen.getByText("resourceMetrics.ofVisible")).toBeInTheDocument();
    expect(screen.getByText("peak")).toBeInTheDocument();
  });

  it("compares the window with the one before it", async () => {
    server.mount(contract.metrics.getResourceMetrics, { body: metrics });

    render(<ResourceMetricsSummary kind="protocol" />);

    expect(await screen.findByText("+48%")).toBeInTheDocument();
  });

  it("claims no change against a window that recorded nothing", async () => {
    server.mount(contract.metrics.getResourceMetrics, {
      body: { ...metrics, previousMeasurements: 0 },
    });

    render(<ResourceMetricsSummary kind="protocol" />);

    await screen.findByText("5.9K");
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("renders nothing when no resource has recorded anything", async () => {
    server.mount(contract.metrics.getResourceMetrics, {
      body: { ...metrics, totalMeasurements: 0, activeCount: 0, activeDays: 0, peak: null },
    });

    const { container } = render(<ResourceMetricsSummary kind="protocol" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
