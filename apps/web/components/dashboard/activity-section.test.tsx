import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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
    devices30d: 2,
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

// Embla watches its slides with an IntersectionObserver, which jsdom lacks. The stub is
// unstubbed afterwards: test files share a worker here.
beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {
        /* noop */
      }
      unobserve() {
        /* noop */
      }
      disconnect() {
        /* noop */
      }
      takeRecords() {
        return [];
      }
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("ActivitySection", () => {
  it("leads with the reader's own measurements and how they changed", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    render(<ActivitySection locale="en-US" />);

    expect(await screen.findByText("60.1K")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "dashboard.activity.title" })).toBeInTheDocument();
    expect(screen.getByText("+20%")).toHaveClass("bg-status-active");
  });

  it("offers a slide per figure, the community's last, with a dot for each", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    render(<ActivitySection locale="en-US" />);

    await screen.findByText("60.1K");
    await waitFor(() =>
      expect(screen.getAllByRole("group").map((slide) => slide.getAttribute("aria-label"))).toEqual(
        [
          "dashboard.activity.label",
          "dailyAverage",
          "dashboard.activity.experimentsLabel",
          "dashboard.activity.communityLabel",
        ],
      ),
    );
    expect(screen.getAllByRole("button", { name: "dashboard.activity.show" })).toHaveLength(4);
    expect(screen.getByText("dashboard.activity.institutions")).toBeInTheDocument();
  });

  it("leaves the community slide out when the platform snapshot is missing", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: { ...platform, community: null } });

    render(<ActivitySection locale="en-US" />);

    await screen.findByText("60.1K");
    expect(screen.getAllByRole("button", { name: "dashboard.activity.show" })).toHaveLength(3);
    expect(screen.queryByText("dashboard.activity.institutions")).not.toBeInTheDocument();
  });

  it("lets the reader stop and restart the rotation", async () => {
    server.mount(contract.metrics.getScopedMetrics, { body: mine });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });
    const user = userEvent.setup();

    render(<ActivitySection locale="en-US" />);

    await user.click(await screen.findByRole("button", { name: "dashboard.activity.pause" }));
    await user.click(screen.getByRole("button", { name: "dashboard.activity.resume" }));

    expect(screen.getByRole("button", { name: "dashboard.activity.pause" })).toBeInTheDocument();
  });

  it("does not colour an unchanged month as a rise", async () => {
    server.mount(contract.metrics.getScopedMetrics, {
      body: { ...mine, scoped: { ...mine.scoped, previousMeasurements: 60_120 } },
    });
    server.mount(contract.metrics.getPublicMetrics, { body: platform });

    render(<ActivitySection locale="en-US" />);

    expect(await screen.findByText("0%")).toHaveClass("bg-muted");
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
