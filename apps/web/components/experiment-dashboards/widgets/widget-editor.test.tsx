import {
  createFilterWidget,
  createRichTextWidget,
  createTableWidget,
  createVisualizationWidget,
} from "@/test/factories";
import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DashboardFormValues } from "../dashboard-form-shell";
import { WidgetEditor } from "./widget-editor";

function renderWidgetEditor(widget: DashboardFormValues["widgets"][number]) {
  renderWithForm<DashboardFormValues>(
    () => <WidgetEditor widget={widget} experimentId="exp-1" widgetIndex={0} isSelected={false} />,
    {
      useFormProps: {
        defaultValues: {
          name: "Dashboard",
          description: "",
          layout: { columns: 12, rowHeight: 80, gap: 16 },
          widgets: [widget],
        },
      },
    },
  );
}

describe("WidgetEditor", () => {
  it("dispatches richText widgets to their editor (preview when unselected)", () => {
    const widget = createRichTextWidget({ config: { html: "<p>preview</p>" } });
    renderWidgetEditor(widget);
    expect(screen.getByText("preview")).toBeInTheDocument();
  });

  it("dispatches table widgets to the table editor's pick-a-table hint when empty", () => {
    const widget = createTableWidget({
      config: { pageSize: 25, showTitle: true, showDescription: true, tableName: undefined },
    });
    renderWidgetEditor(widget);
    expect(screen.getByText("editor.tableConfig.pickTable")).toBeInTheDocument();
  });

  it("dispatches filter widgets to the filter editor's configure hint when empty", () => {
    const widget = createFilterWidget({ config: { showTitle: true, showDescription: true } });
    renderWidgetEditor(widget);
    expect(screen.getByText("editor.filterConfig.configureLabel")).toBeInTheDocument();
  });

  it("dispatches visualization widgets to the visualization editor's pick hint", async () => {
    const widget = createVisualizationWidget({
      config: { visualizationId: undefined, showTitle: true, showDescription: false },
    });
    renderWidgetEditor(widget);
    // next/dynamic pulls the Plotly chain; a cold import can exceed the default 1s.
    expect(
      await screen.findByText(
        "editor.visualizationConfig.pickVisualization",
        {},
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
  });
});
