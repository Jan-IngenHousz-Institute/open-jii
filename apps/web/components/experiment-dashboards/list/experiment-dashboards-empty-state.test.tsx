import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ExperimentDashboardsEmptyState } from "./experiment-dashboards-empty-state";

const dashboardsHref = "/en-US/platform/experiments/exp-1/dashboards";
const visualizationsHref = "/en-US/platform/experiments/exp-1/analysis/visualizations";

describe("ExperimentDashboardsEmptyState", () => {
  it("renders the empty title and description", () => {
    render(
      <ExperimentDashboardsEmptyState
        dashboardsHref={dashboardsHref}
        visualizationsHref={visualizationsHref}
        hasAccess
      />,
    );
    expect(screen.getByText("overview.emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("overview.emptyDescription")).toBeInTheDocument();
  });

  it("shows the createDashboard CTA when hasAccess is true", () => {
    render(
      <ExperimentDashboardsEmptyState
        dashboardsHref={dashboardsHref}
        visualizationsHref={visualizationsHref}
        hasAccess
      />,
    );
    const createLink = screen.getByRole("link", { name: /overview\.createDashboard/ });
    expect(createLink).toHaveAttribute("href", dashboardsHref);
  });

  it("hides the createDashboard CTA when hasAccess is false", () => {
    render(
      <ExperimentDashboardsEmptyState
        dashboardsHref={dashboardsHref}
        visualizationsHref={visualizationsHref}
        hasAccess={false}
      />,
    );
    expect(screen.queryByRole("link", { name: /overview\.createDashboard/ })).toBeNull();
  });

  it("always shows the browseVisualizations CTA pointing at the visualizations href", () => {
    render(
      <ExperimentDashboardsEmptyState
        dashboardsHref={dashboardsHref}
        visualizationsHref={visualizationsHref}
        hasAccess={false}
      />,
    );
    const browseLink = screen.getByRole("link", { name: /overview\.browseVisualizations/ });
    expect(browseLink).toHaveAttribute("href", visualizationsHref);
  });
});
