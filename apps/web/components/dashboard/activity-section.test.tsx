import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ActivitySection } from "./activity-section";

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

describe("ActivitySection", () => {
  it("leads with the reader's own activity and its trend", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    render(<ActivitySection locale="en-US" />);

    expect(await screen.findByText("60.1K")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "dashboard.activity.title" })).toBeInTheDocument();
    expect(screen.getByText("dashboard.activity.label")).toBeInTheDocument();
    expect(screen.getByText("+20%")).toBeInTheDocument();
    expect(screen.getByText("dashboard.activity.activeExperiments")).toBeInTheDocument();
    expect(screen.getByText("dashboard.activity.contributors")).toBeInTheDocument();
  });

  it("does not colour an unchanged month as a rise", async () => {
    server.mount(contract.metrics.getScopedMetrics, {
      body: { ...mine, scoped: { ...mine.scoped, previousMeasurements: 60_120 } },
    });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    render(<ActivitySection locale="en-US" />);

    expect(await screen.findByText("0%")).toHaveClass("bg-muted");
  });

  it("puts the community total beside the reader's figures", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    render(<ActivitySection locale="en-US" />);

    const total = await screen.findByText("dashboard.activity.community");
    expect(total.closest("li")).toHaveAttribute("title", "18,883,130");
  });

  it("drops the community total when the platform snapshot is missing", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: { ...platform, community: null } });

    render(<ActivitySection locale="en-US" />);

    await screen.findByText("60.1K");
    expect(screen.queryByText("dashboard.activity.community")).not.toBeInTheDocument();
  });

  it("holds the section's place while the figures are still loading", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine, delay: "infinite" });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    const { container } = render(<ActivitySection locale="en-US" />);

    await waitFor(() => {
      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("60.1K")).not.toBeInTheDocument();
  });

  it("renders nothing for a reader who recorded nothing", async () => {
    server.mount(contract.metrics.getScopedMetrics, {
      body: { ...mine, scoped: { ...mine.scoped, measurements30d: 0 } },
    });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    const { container } = render(<ActivitySection locale="en-US" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("renders nothing without a scoped snapshot", async () => {
    server.mount(contract.metrics.getScopedMetrics, {
      body: { scope: "mine", scoped: null, baseline: null, computedAt: null },
    });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    const { container } = render(<ActivitySection locale="en-US" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
