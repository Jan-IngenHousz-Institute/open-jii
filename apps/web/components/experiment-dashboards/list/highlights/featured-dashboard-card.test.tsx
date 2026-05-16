import { createExperimentDashboard } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { formatDate } from "@/util/date";
import { describe, expect, it, vi } from "vitest";

import { FeaturedDashboardCard } from "./featured-dashboard-card";

// Thumbnail does heavy DOM-measurement work tested separately; here we only
// care that it received the dashboard and surfaces the name as alt text.
vi.mock("../thumbnail/dashboard-thumbnail", () => ({
  DashboardThumbnail: ({ dashboard }: { dashboard: { name: string } }) => (
    <div role="img" aria-label={dashboard.name} data-testid="thumb" />
  ),
}));

describe("FeaturedDashboardCard", () => {
  it("renders the dashboard name as a heading link to the provided href", () => {
    const dashboard = createExperimentDashboard({ name: "Plant growth" });
    render(<FeaturedDashboardCard dashboard={dashboard} href="/the/href" />);

    const link = screen.getByRole("link", { name: /Plant growth/ });
    expect(link).toHaveAttribute("href", "/the/href");
    expect(screen.getByText("Plant growth")).toBeInTheDocument();
  });

  it("renders the updated-ago label without an author when createdByName is missing", () => {
    const dashboard = createExperimentDashboard({
      updatedAt: "2024-03-10T00:00:00.000Z",
      createdByName: undefined,
    });
    render(<FeaturedDashboardCard dashboard={dashboard} href="/x" />);

    // i18n is mocked to return the key, so the date is interpolated separately by the component.
    expect(screen.getByText("ui.labels.updatedAgo")).toBeInTheDocument();
    expect(screen.queryByText(`· ${formatDate(dashboard.updatedAt)}`)).toBeNull();
  });

  it("appends the author with a separator when createdByName is set", () => {
    const dashboard = createExperimentDashboard({ createdByName: "Sam" });
    const { container } = render(<FeaturedDashboardCard dashboard={dashboard} href="/x" />);
    expect(container.textContent).toContain("· Sam");
  });

  it("renders the thumbnail with the dashboard's name for alt text", () => {
    const dashboard = createExperimentDashboard({ name: "My dash" });
    render(<FeaturedDashboardCard dashboard={dashboard} href="/x" />);
    expect(screen.getByRole("img", { name: "My dash" })).toBeInTheDocument();
  });
});
