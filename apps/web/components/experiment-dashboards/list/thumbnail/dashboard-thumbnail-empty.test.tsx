import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DashboardThumbnailEmpty } from "./dashboard-thumbnail-empty";

describe("DashboardThumbnailEmpty", () => {
  it("renders the empty title and description", () => {
    render(<DashboardThumbnailEmpty />);
    expect(screen.getByText("widget.emptyDashboard")).toBeInTheDocument();
    expect(screen.getByText("widget.emptyDashboardDescription")).toBeInTheDocument();
  });

  it("renders a LayoutGrid icon inside the muted circle", () => {
    const { container } = render(<DashboardThumbnailEmpty />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
