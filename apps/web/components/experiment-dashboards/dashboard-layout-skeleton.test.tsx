import { createExperimentDashboard, createRichTextWidget } from "@/test/factories";
import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DashboardLayoutSkeleton } from "./dashboard-layout-skeleton";

describe("DashboardLayoutSkeleton", () => {
  it("renders one skeleton block per widget in the dashboard", () => {
    const dashboard = createExperimentDashboard({
      widgets: [createRichTextWidget(), createRichTextWidget(), createRichTextWidget()],
    });
    const { container } = render(
      <DashboardLayoutSkeleton dashboard={dashboard} innerHeight={400} scale={1} width={800} />,
    );

    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(3);
  });

  it("renders an empty grid (no skeletons) when the dashboard has no widgets", () => {
    const dashboard = createExperimentDashboard({ widgets: [] });
    const { container } = render(
      <DashboardLayoutSkeleton dashboard={dashboard} innerHeight={400} scale={1} width={800} />,
    );
    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(0);
  });

  it("applies the dashboard layout to the grid container", () => {
    const dashboard = createExperimentDashboard({
      widgets: [createRichTextWidget()],
      layout: { columns: 6, rowHeight: 50, gap: 8 },
    });
    const { container } = render(
      <DashboardLayoutSkeleton dashboard={dashboard} innerHeight={300} scale={1} width={600} />,
    );

    const grid = container.firstElementChild;
    expect(grid).not.toBeNull();
    if (grid instanceof HTMLElement) {
      expect(grid.style.gridTemplateColumns).toContain("repeat(6");
      expect(grid.style.gridAutoRows).toBe("50px");
      expect(grid.style.gap).toBe("8px");
      expect(grid.style.width).toBe("600px");
      expect(grid.style.height).toBe("300px");
    }
  });

  it("places each skeleton at the widget's 1-indexed grid coordinates", () => {
    const widget = createRichTextWidget({
      id: "w-1",
      layout: { col: 3, row: 2, colSpan: 4, rowSpan: 3 },
    });
    const dashboard = createExperimentDashboard({ widgets: [widget] });
    const { container } = render(
      <DashboardLayoutSkeleton dashboard={dashboard} innerHeight={400} scale={1} width={800} />,
    );

    const skeleton = container.querySelector('[class*="animate-pulse"]');
    if (skeleton instanceof HTMLElement) {
      const styleAttr = skeleton.getAttribute("style") ?? "";
      expect(styleAttr).toContain("grid-column: 4 / span 4");
      expect(styleAttr).toContain("grid-row: 3 / span 3");
    }
  });

  it("falls back to scale=1 when given scale=0 to avoid collapsing the grid", () => {
    const dashboard = createExperimentDashboard({ widgets: [] });
    const { container } = render(
      <DashboardLayoutSkeleton dashboard={dashboard} innerHeight={400} scale={0} width={800} />,
    );
    const grid = container.firstElementChild;
    if (grid instanceof HTMLElement) {
      expect(grid.style.transform).toBe("scale(1)");
    }
  });

  it("uses the supplied scale when non-zero", () => {
    const dashboard = createExperimentDashboard({ widgets: [] });
    const { container } = render(
      <DashboardLayoutSkeleton dashboard={dashboard} innerHeight={400} scale={0.5} width={800} />,
    );
    const grid = container.firstElementChild;
    if (grid instanceof HTMLElement) {
      expect(grid.style.transform).toBe("scale(0.5)");
    }
  });

  it("marks the wrapper as aria-hidden so it doesn't pollute the a11y tree", () => {
    const dashboard = createExperimentDashboard({ widgets: [] });
    const { container } = render(
      <DashboardLayoutSkeleton dashboard={dashboard} innerHeight={400} scale={1} width={800} />,
    );
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});
