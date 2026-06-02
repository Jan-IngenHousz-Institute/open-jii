import { createExperimentDashboard, createRichTextWidget } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DashboardThumbnail } from "./dashboard-thumbnail";

// jsdom's ResizeObserver is a noop; pin the hook to a known measured size
// so the thumbnail enters its "measured + scaled" branch deterministically.
vi.mock("@repo/ui/hooks/use-element-size", () => ({
  useElementSize: () => {
    const ref = React.useRef<HTMLDivElement>(null);
    return [ref, { width: 640, height: 480 }] as const;
  },
}));

// IntersectionObserver isn't implemented either; force inView=true.
vi.mock("@repo/ui/hooks/use-in-view", () => ({
  useInView: () => {
    const ref = React.useRef<HTMLDivElement>(null);
    return [ref, true] as const;
  },
}));

// Pretend the data layer has already settled for this experiment so the
// renderer is unblocked.
vi.mock("./use-ever-loaded", () => ({
  useEverLoaded: () => true,
}));

// DashboardRenderer transitively reaches into widget views. We only care
// that this thumbnail handed it the dashboard.
vi.mock("../../dashboard-renderer", () => ({
  DashboardRenderer: ({ dashboard }: { dashboard: { id: string } }) => (
    <div data-testid="renderer" data-dashboard-id={dashboard.id} />
  ),
}));

describe("DashboardThumbnail", () => {
  it("renders an aria-labelled img region using the dashboard name", () => {
    const dashboard = createExperimentDashboard({ name: "Photosynth" });
    render(<DashboardThumbnail dashboard={dashboard} experimentId="exp-1" />);
    expect(screen.getByRole("img", { name: "Photosynth" })).toBeInTheDocument();
  });

  it("renders the empty placeholder when the dashboard has no widgets", () => {
    const dashboard = createExperimentDashboard({ widgets: [] });
    render(<DashboardThumbnail dashboard={dashboard} experimentId="exp-1" />);
    expect(screen.getByText("widget.emptyDashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("renderer")).toBeNull();
  });

  it("renders the scaled dashboard once widgets exist and the frame is measured", () => {
    const dashboard = createExperimentDashboard({
      widgets: [createRichTextWidget({ layout: { col: 0, row: 0, colSpan: 6, rowSpan: 2 } })],
    });
    render(<DashboardThumbnail dashboard={dashboard} experimentId="exp-1" />);
    expect(screen.getByTestId("renderer")).toBeInTheDocument();
  });

  it("respects the maxHeight prop as the upper bound on the rendered height", () => {
    const dashboard = createExperimentDashboard({
      // Tall layout: many rows → unbounded height would exceed maxHeight.
      widgets: [createRichTextWidget({ layout: { col: 0, row: 0, colSpan: 12, rowSpan: 10 } })],
      layout: { rowHeight: 200, gap: 0, columns: 12 },
    });
    render(<DashboardThumbnail dashboard={dashboard} experimentId="exp-1" maxHeight={100} />);
    const region = screen.getByRole("img", { name: dashboard.name });
    expect(region.style.height).toBe("100px");
  });

  it("falls back to the empty thumbnail placeholder text (not the renderer) for zero widgets", () => {
    const dashboard = createExperimentDashboard({ widgets: [] });
    render(<DashboardThumbnail dashboard={dashboard} experimentId="exp-1" />);
    expect(screen.getByText("widget.emptyDashboardDescription")).toBeInTheDocument();
  });
});
