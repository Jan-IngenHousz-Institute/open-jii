import { createExperimentDashboard, createRichTextWidget } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DashboardThumbnail } from "./dashboard-thumbnail";

vi.mock("@repo/ui/hooks/use-element-size", () => ({
  useElementSize: () => {
    const ref = React.useRef<HTMLDivElement>(null);
    return [ref, { width: 640, height: 480 }] as const;
  },
}));

vi.mock("@repo/ui/hooks/use-in-view", () => ({
  useInView: () => {
    const ref = React.useRef<HTMLDivElement>(null);
    return [ref, true] as const;
  },
}));

vi.mock("./use-ever-loaded", () => ({
  useEverLoaded: () => true,
}));

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
      widgets: [createRichTextWidget({ layout: { col: 0, row: 0, colSpan: 12, rowSpan: 10 } })],
      layout: { rowHeight: 200, gap: 0, columns: 12 },
    });
    render(<DashboardThumbnail dashboard={dashboard} experimentId="exp-1" maxHeight={100} />);
    const region = screen.getByRole("img", { name: dashboard.name });
    expect(region.style.maxHeight).toBe("100px");
  });

  // A measured `width * ratio` height is only correct after the ResizeObserver
  // fires, so the frame used to open at maxHeight and collapse. The ratio makes
  // the first paint the final size, which is what lets the card hug it.
  it("sizes itself from the dashboard's aspect ratio, not a measured height", () => {
    const dashboard = createExperimentDashboard({
      // 2 rows of 80 plus one 16px gap = 176 tall against the 1280 render width.
      widgets: [createRichTextWidget({ layout: { col: 0, row: 0, colSpan: 12, rowSpan: 2 } })],
      layout: { rowHeight: 80, gap: 16, columns: 12 },
    });
    render(<DashboardThumbnail dashboard={dashboard} experimentId="exp-1" maxHeight={460} />);
    const region = screen.getByRole("img", { name: dashboard.name });

    expect(region.style.aspectRatio).toBe("1280 / 176");
    expect(region.style.height).toBe("");
  });

  it("falls back to the empty thumbnail placeholder text (not the renderer) for zero widgets", () => {
    const dashboard = createExperimentDashboard({ widgets: [] });
    render(<DashboardThumbnail dashboard={dashboard} experimentId="exp-1" />);
    expect(screen.getByText("widget.emptyDashboardDescription")).toBeInTheDocument();
  });
});
