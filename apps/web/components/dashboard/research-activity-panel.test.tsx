import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ResearchActivityPanel } from "./research-activity-panel";

const WINDOW_DAYS = 30;

// The window slides, so the fixture is anchored to today rather than to a date
// that would drift out of range.
const dayAt = (offset: number) =>
  new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const activity = Array.from({ length: WINDOW_DAYS }, (_, index) => ({
  date: dayAt(WINDOW_DAYS - 1 - index),
  measurements: index === WINDOW_DAYS - 1 ? 2_120 : 2_000,
}));

const mine = {
  scope: "mine" as const,
  scoped: {
    measurements30d: 60_120,
    activeExperiments30d: 3,
    contributors30d: 5,
    activity,
    previousMeasurements: 50_100,
    activeDays: WINDOW_DAYS,
    peak: { date: dayAt(0), measurements: 2_120 },
    lastActivityDate: dayAt(0),
  },
  baseline: { measurements30d: 18_439_869, activeExperiments30d: 11 },
  computedAt: "2026-08-30T12:48:55.000Z",
};

const platform = {
  hero: null,
  liveness: null,
  community: {
    measurements30d: 18_883_130,
    activeExperiments30d: 11,
    contributors30d: 9,
    devices30d: 12,
    institutions30d: 4,
  },
  activity: [],
  hourly: [],
  families: [],
  derivedParameter: null,
  sensorParameter: null,
  captions: [],
  computedAt: "2026-08-30T12:48:55.000Z",
};

describe("ResearchActivityPanel", () => {
  it("leads with the reader's own activity and its trend", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    render(<ResearchActivityPanel locale="en-US" />);

    expect(await screen.findByText("60.1K")).toBeInTheDocument();
    expect(screen.getByText("dashboard.activity.label")).toBeInTheDocument();
    expect(screen.getByText("dashboard.activity.experimentsLabel")).toBeInTheDocument();
    expect(screen.getByText("+20%")).toBeInTheDocument();
  });

  it("puts the community beside the reader rather than in a footnote", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    render(<ResearchActivityPanel locale="en-US" />);

    expect(await screen.findByText("dashboard.activity.communityLabel")).toBeInTheDocument();
    expect(screen.getByText("18.9M")).toBeInTheDocument();
  });

  it("drops the community card when the platform snapshot is missing", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: { ...platform, community: null } });

    render(<ResearchActivityPanel locale="en-US" />);

    await screen.findByText("60.1K");
    expect(screen.queryByText("dashboard.activity.communityLabel")).not.toBeInTheDocument();
  });

  it("holds the band's shape while the figures are still loading", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine, delay: "infinite" });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    const { container } = render(<ResearchActivityPanel locale="en-US" />);

    await waitFor(() => {
      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("60.1K")).not.toBeInTheDocument();
  });

  it("renders nothing without a scoped snapshot", async () => {
    server.mount(contract.metrics.getScopedMetrics, {
      body: { scope: "mine", scoped: null, baseline: null, computedAt: null },
    });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    const { container } = render(<ResearchActivityPanel locale="en-US" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
