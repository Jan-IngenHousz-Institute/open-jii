import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ExperimentActivityPulse } from "./experiment-activity-pulse";

const WINDOW_DAYS = 30;

// The window slides, so the fixture is anchored to today rather than to a date
// that would drift out of range.
const dayAt = (offset: number) =>
  new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const activity = Array.from({ length: WINDOW_DAYS }, (_, index) => ({
  date: dayAt(WINDOW_DAYS - 1 - index),
  measurements: index === WINDOW_DAYS - 1 ? 62 : 40,
}));

const response = {
  scope: "experiment" as const,
  scoped: {
    measurements30d: 1_222,
    activeExperiments30d: 1,
    contributors30d: 2,
    activity,
    previousMeasurements: 1_000,
    activeDays: WINDOW_DAYS,
    peak: { date: dayAt(0), measurements: 62 },
    lastActivityDate: dayAt(0),
  },
  baseline: { measurements30d: 18_439_869, activeExperiments30d: 11 },
  computedAt: "2026-08-30T12:48:55.000Z",
};

describe("ExperimentActivityPulse", () => {
  it("reports what this experiment collected, against the window before it", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: response });

    render(<ExperimentActivityPulse experimentId="e1" />);

    expect(await screen.findByText("1.2K")).toBeInTheDocument();
    expect(screen.getByText("experiment.measurements")).toBeInTheDocument();
    expect(screen.getByText("+22%")).toBeInTheDocument();
    expect(screen.getByText("peak")).toBeInTheDocument();
  });

  it("drops the contributors card rather than crediting nobody", async () => {
    server.mount(contract.metrics.getScopedMetrics, {
      body: { ...response, scoped: { ...response.scoped, contributors30d: 0 } },
    });

    render(<ExperimentActivityPulse experimentId="e1" />);

    expect(await screen.findByText("experiment.measurements")).toBeInTheDocument();
    expect(screen.queryByText("experiment.contributors")).not.toBeInTheDocument();
  });

  it("says so plainly when nothing was recorded", async () => {
    server.mount(contract.metrics.getScopedMetrics, {
      body: {
        ...response,
        scoped: {
          measurements30d: 0,
          activeExperiments30d: 0,
          contributors30d: 0,
          activity: [],
          previousMeasurements: 0,
          activeDays: 0,
          peak: null,
          lastActivityDate: null,
        },
      },
    });

    render(<ExperimentActivityPulse experimentId="e1" />);

    expect(await screen.findByText("experiment.quiet")).toBeInTheDocument();
    expect(screen.queryByText("experiment.measurements")).not.toBeInTheDocument();
  });

  it("holds the band's shape while the figures are still loading", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: response, delay: "infinite" });

    const { container } = render(<ExperimentActivityPulse experimentId="e1" />);

    await waitFor(() => {
      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("1.2K")).not.toBeInTheDocument();
  });

  it("renders nothing while the warehouse has no snapshot", async () => {
    server.mount(contract.metrics.getScopedMetrics, {
      body: { scope: "experiment", scoped: null, baseline: null, computedAt: null },
    });

    const { container } = render(<ExperimentActivityPulse experimentId="e1" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
