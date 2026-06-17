import { createExperimentDashboard } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import ExperimentDashboardsHighlights from "./experiment-dashboards-highlights";

vi.mock("./highlight-card", () => ({
  HighlightCard: ({
    dashboard,
    href,
    thumbnailMaxHeight,
  }: {
    dashboard: { id: string; name: string };
    href: string;
    thumbnailMaxHeight: number;
  }) => (
    <a data-testid="card" data-id={dashboard.id} data-thumb-height={thumbnailMaxHeight} href={href}>
      {dashboard.name}
    </a>
  ),
}));

describe("ExperimentDashboardsHighlights", () => {
  it("renders skeleton cards while loading", () => {
    const { container } = render(
      <ExperimentDashboardsHighlights dashboards={[]} experimentId="exp-1" isLoading />,
    );
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("renders the default count of 3 skeletons when loading with no count override", () => {
    const { container } = render(
      <ExperimentDashboardsHighlights dashboards={[]} experimentId="exp-1" isLoading />,
    );
    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(3);
  });

  it("returns null (renders nothing) when there are no dashboards and not loading", () => {
    const { container } = render(
      <ExperimentDashboardsHighlights dashboards={[]} experimentId="exp-1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the N most recently updated dashboards, sorted desc", () => {
    const items = [
      createExperimentDashboard({ name: "Older", updatedAt: "2024-01-01T00:00:00.000Z" }),
      createExperimentDashboard({ name: "Newer", updatedAt: "2024-03-01T00:00:00.000Z" }),
      createExperimentDashboard({ name: "Middle", updatedAt: "2024-02-01T00:00:00.000Z" }),
    ];
    render(<ExperimentDashboardsHighlights dashboards={items} experimentId="exp-1" count={2} />);

    const cards = screen.getAllByTestId("card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Newer");
    expect(cards[1]).toHaveTextContent("Middle");
  });

  it("builds card hrefs against /experiments by default", () => {
    const dashboard = createExperimentDashboard({ id: "dash-9" });
    render(
      <ExperimentDashboardsHighlights dashboards={[dashboard]} experimentId="exp-1" count={1} />,
    );
    expect(screen.getByTestId("card")).toHaveAttribute(
      "href",
      "/platform/experiments/exp-1/dashboards/dash-9",
    );
  });

  it("switches to /experiments-archive when isArchived is set", () => {
    const dashboard = createExperimentDashboard({ id: "dash-x" });
    render(
      <ExperimentDashboardsHighlights
        dashboards={[dashboard]}
        experimentId="exp-1"
        count={1}
        isArchived
      />,
    );
    expect(screen.getByTestId("card")).toHaveAttribute(
      "href",
      "/platform/experiments-archive/exp-1/dashboards/dash-x",
    );
  });
});
