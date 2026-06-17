import { createExperimentDashboard, createRichTextWidget } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { DashboardRenderer } from "./dashboard-renderer";

// Each widget view transitively imports recharts / Plotly / Quill etc;
// keep the renderer test focused on slot wiring.
vi.mock("./widgets/widget-renderer", () => ({
  WidgetRenderer: ({ widget }: { widget: { id: string; type: string } }) => (
    <div data-testid="widget" data-id={widget.id} data-type={widget.type} />
  ),
}));

describe("DashboardRenderer", () => {
  it("renders the empty placeholder when the dashboard has no widgets", () => {
    const dashboard = createExperimentDashboard({ widgets: [] });
    render(<DashboardRenderer dashboard={dashboard} experimentId="exp-1" />);

    expect(screen.getByText("ui.messages.emptyDashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("widget")).toBeNull();
  });

  it("renders one widget slot per widget in the dashboard", () => {
    const dashboard = createExperimentDashboard({
      widgets: [
        createRichTextWidget({ id: "w-1" }),
        createRichTextWidget({ id: "w-2" }),
        createRichTextWidget({ id: "w-3" }),
      ],
    });
    render(<DashboardRenderer dashboard={dashboard} experimentId="exp-1" />);
    expect(screen.getAllByTestId("widget")).toHaveLength(3);
  });

  it("applies the dashboard's layout to the grid container styles", () => {
    const dashboard = createExperimentDashboard({
      widgets: [createRichTextWidget()],
      layout: { columns: 8, rowHeight: 100, gap: 20 },
    });
    const { container } = render(<DashboardRenderer dashboard={dashboard} experimentId="exp-1" />);
    const grid = container.querySelector('[style*="grid-template-columns"]');
    expect(grid).not.toBeNull();
    if (grid instanceof HTMLElement) {
      expect(grid.style.gridTemplateColumns).toContain("repeat(8");
      expect(grid.style.gridAutoRows).toBe("100px");
      expect(grid.style.gap).toBe("20px");
    }
  });

  it("scales rowHeight and gap by the `scale` prop", () => {
    const dashboard = createExperimentDashboard({
      widgets: [createRichTextWidget()],
      layout: { columns: 12, rowHeight: 80, gap: 16 },
    });
    const { container } = render(
      <DashboardRenderer dashboard={dashboard} experimentId="exp-1" scale={0.5} />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]');
    if (grid instanceof HTMLElement) {
      expect(grid.style.gridAutoRows).toBe("40px");
      expect(grid.style.gap).toBe("8px");
    }
  });

  it("places each widget at the layout's grid-row / grid-column position (1-indexed)", () => {
    const widget = createRichTextWidget({
      id: "w-place",
      layout: { col: 2, row: 1, colSpan: 4, rowSpan: 3 },
    });
    const dashboard = createExperimentDashboard({ widgets: [widget] });
    const { container } = render(<DashboardRenderer dashboard={dashboard} experimentId="exp-1" />);

    // jsdom doesn't synthesize the longhand from `grid-column` shorthand,
    // so assert against the raw style attribute on the placement div instead.
    const styled = Array.from(container.querySelectorAll<HTMLElement>("[style]")).find((el) =>
      (el.getAttribute("style") ?? "").includes("grid-column"),
    );
    expect(styled).toBeDefined();
    const styleAttr = styled?.getAttribute("style") ?? "";
    expect(styleAttr).toContain("grid-column: 3 / span 4");
    expect(styleAttr).toContain("grid-row: 2 / span 3");
  });
});
