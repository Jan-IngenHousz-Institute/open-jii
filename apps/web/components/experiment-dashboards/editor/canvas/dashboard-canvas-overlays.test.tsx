import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DashboardCanvasEmptyState, PlacementGhost } from "./dashboard-canvas-overlays";

describe("DashboardCanvasEmptyState", () => {
  it("renders the empty dashboard headline and editor hint", () => {
    render(<DashboardCanvasEmptyState />);
    expect(screen.getByText("ui.messages.emptyDashboard")).toBeInTheDocument();
    expect(screen.getByText("ui.messages.emptyDashboardEditorHint")).toBeInTheDocument();
  });

  it("is hidden from assistive tech (decorative placeholder)", () => {
    const { container } = render(<DashboardCanvasEmptyState />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden");
  });
});

describe("PlacementGhost", () => {
  it("renders the drop-hint key", () => {
    render(<PlacementGhost />);
    expect(screen.getByText("editor.modebar.dropHint")).toBeInTheDocument();
  });

  it("is aria-hidden so screen readers ignore the visual snap rectangle", () => {
    const { container } = render(<PlacementGhost />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden");
  });
});
