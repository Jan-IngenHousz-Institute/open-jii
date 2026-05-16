import {
  createFilterWidget,
  createRichTextWidget,
  createTableWidget,
  createVisualizationWidget,
} from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DashboardFiltersProvider } from "../dashboard-filters-context";
import { WidgetRenderer } from "./widget-renderer";

describe("WidgetRenderer", () => {
  it("dispatches richText widgets to the rich-text view", () => {
    const widget = createRichTextWidget({ config: { html: "<p>read me</p>" } });
    render(<WidgetRenderer widget={widget} experimentId="exp-1" />);
    expect(screen.getByText("read me")).toBeInTheDocument();
  });

  it("dispatches table widgets to the table view (empty-state when no tableName)", () => {
    const widget = createTableWidget({
      config: { pageSize: 25, showTitle: true, showDescription: true, tableName: undefined },
    });
    render(<WidgetRenderer widget={widget} experimentId="exp-1" />);
    expect(screen.getByText("widget.emptyTable")).toBeInTheDocument();
  });

  it("dispatches filter widgets to the filter view (empty-state when not configured)", () => {
    const widget = createFilterWidget({
      config: { showTitle: true, showDescription: true },
    });
    render(
      <DashboardFiltersProvider widgets={[widget]}>
        <WidgetRenderer widget={widget} experimentId="exp-1" />
      </DashboardFiltersProvider>,
    );
    expect(screen.getByText("widget.emptyFilter")).toBeInTheDocument();
  });

  it("dispatches visualization widgets to the visualization view (empty when no viz picked)", async () => {
    const widget = createVisualizationWidget({
      config: { visualizationId: undefined, showTitle: true, showDescription: false },
    });
    render(<WidgetRenderer widget={widget} experimentId="exp-1" />);
    // The visualization renderer is dynamic — wait for it to mount.
    expect(await screen.findByText("widget.emptyVisualization")).toBeInTheDocument();
  });
});
