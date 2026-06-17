import { createExperimentDashboard } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { HighlightCard } from "./highlight-card";

vi.mock("../thumbnail/dashboard-thumbnail", () => ({
  DashboardThumbnail: ({
    dashboard,
    maxHeight,
  }: {
    dashboard: { name: string };
    maxHeight: number;
  }) => (
    <div role="img" aria-label={dashboard.name} data-testid="thumb" data-max-height={maxHeight} />
  ),
}));

describe("HighlightCard", () => {
  it("renders the dashboard name and the updated-ago label", () => {
    const dashboard = createExperimentDashboard({ name: "Daily metrics" });
    render(<HighlightCard dashboard={dashboard} href="/dash" thumbnailMaxHeight={220} />);

    expect(screen.getByText("Daily metrics")).toBeInTheDocument();
    expect(screen.getByText(/ui\.labels\.updatedAgo/)).toBeInTheDocument();
  });

  it("renders an overlay link with the dashboard name as the accessible label", () => {
    const dashboard = createExperimentDashboard({ name: "Overview" });
    render(<HighlightCard dashboard={dashboard} href="/some/path" thumbnailMaxHeight={220} />);

    const link = screen.getByRole("link", { name: "Overview" });
    expect(link).toHaveAttribute("href", "/some/path");
  });

  it("forwards the thumbnailMaxHeight prop to the thumbnail", () => {
    render(
      <HighlightCard dashboard={createExperimentDashboard()} href="/x" thumbnailMaxHeight={350} />,
    );
    expect(screen.getByTestId("thumb").getAttribute("data-max-height")).toBe("350");
  });

  it("appends the author after the date when createdByName is present", () => {
    const dashboard = createExperimentDashboard({ createdByName: "Alex" });
    const { container } = render(
      <HighlightCard dashboard={dashboard} href="/x" thumbnailMaxHeight={220} />,
    );
    expect(container.textContent).toContain("· Alex");
  });

  it("omits the separator when createdByName is missing", () => {
    const dashboard = createExperimentDashboard({ createdByName: undefined });
    const { container } = render(
      <HighlightCard dashboard={dashboard} href="/x" thumbnailMaxHeight={220} />,
    );
    expect(container.textContent).not.toContain("·");
  });
});
