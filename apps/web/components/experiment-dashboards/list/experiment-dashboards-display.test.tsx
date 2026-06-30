import { createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import ExperimentDashboardsDisplay from "./experiment-dashboards-display";

// Embla carousel uses IntersectionObserver; jsdom doesn't ship one.
beforeAll(() => {
  if (typeof globalThis.IntersectionObserver === "undefined") {
    class IO {
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
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
    }
    Object.defineProperty(globalThis, "IntersectionObserver", { value: IO, writable: true });
    Object.defineProperty(window, "IntersectionObserver", { value: IO, writable: true });
  }
});

// FeaturedDashboardCard pulls in DashboardThumbnail and the renderer; the
// carousel surface only needs to know the card slot was filled.
vi.mock("./highlights/featured-dashboard-card", () => ({
  FeaturedDashboardCard: ({ dashboard, href }: { dashboard: { name: string }; href: string }) => (
    <a href={href} data-testid="featured-card">
      {dashboard.name}
    </a>
  ),
}));

describe("ExperimentDashboardsDisplay", () => {
  it("renders the loading skeleton while dashboards are being fetched", () => {
    server.mount(orpcContract.experiments.listExperimentDashboards, {
      body: [],
      delay: "infinite",
    });
    render(<ExperimentDashboardsDisplay experimentId="exp-1" />);
    expect(screen.getByText("overview.title")).toBeInTheDocument();
    // The skeleton is rendered while the query is pending.
    expect(document.querySelector('[class*="animate-pulse"]')).toBeInTheDocument();
  });

  it("renders the empty state when the API returns zero dashboards", async () => {
    server.mount(orpcContract.experiments.listExperimentDashboards, { body: [] });
    render(<ExperimentDashboardsDisplay experimentId="exp-1" hasAccess />);
    expect(await screen.findByText("overview.emptyTitle")).toBeInTheDocument();
  });

  it("renders the carousel of featured cards when dashboards exist", async () => {
    server.mount(orpcContract.experiments.listExperimentDashboards, {
      body: [
        createExperimentDashboard({ name: "Daily Overview" }),
        createExperimentDashboard({ name: "Photosynth" }),
      ],
    });
    render(<ExperimentDashboardsDisplay experimentId="exp-1" />);
    await waitFor(() => {
      expect(screen.getByText("Daily Overview")).toBeInTheDocument();
      expect(screen.getByText("Photosynth")).toBeInTheDocument();
    });
  });

  it("shows the 'view all' link to the dashboards index when at least one dashboard exists", async () => {
    server.mount(orpcContract.experiments.listExperimentDashboards, {
      body: [createExperimentDashboard()],
    });
    render(<ExperimentDashboardsDisplay experimentId="exp-1" />);
    const viewAll = await screen.findByRole("link", { name: "overview.viewAll" });
    expect(viewAll).toHaveAttribute("href", "/en-US/platform/experiments/exp-1/dashboards");
  });

  it("uses the archived base path when isArchived is set", async () => {
    server.mount(orpcContract.experiments.listExperimentDashboards, {
      body: [createExperimentDashboard({ name: "Archived dash" })],
    });
    render(<ExperimentDashboardsDisplay experimentId="exp-2" isArchived />);
    const viewAll = await screen.findByRole("link", { name: "overview.viewAll" });
    expect(viewAll).toHaveAttribute("href", "/en-US/platform/experiments-archive/exp-2/dashboards");
  });

  it("does not render the 'view all' link when the list is empty", async () => {
    server.mount(orpcContract.experiments.listExperimentDashboards, { body: [] });
    render(<ExperimentDashboardsDisplay experimentId="exp-1" />);
    await screen.findByText("overview.emptyTitle");
    expect(screen.queryByRole("link", { name: "overview.viewAll" })).toBeNull();
  });
});
