import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type {
  ExperimentDashboardWidget,
  ExperimentRichTextWidget,
} from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { DashboardFiltersProvider } from "../../dashboard-filters-context";
import type { DashboardFormValues } from "../../dashboard-form-shell";
import { WidgetSlot } from "./widget-slot";

const richTextWidget: ExperimentRichTextWidget = {
  id: "rt-w1",
  type: "richText",
  layout: { col: 0, row: 0, colSpan: 6, rowSpan: 2 },
  config: { html: "<p>hello world</p>" },
};

function setup({
  widget = richTextWidget,
  isSelected = false,
  onSelect = vi.fn(),
}: {
  widget?: ExperimentDashboardWidget;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
} = {}) {
  return renderWithForm<DashboardFormValues>(
    () => (
      <DashboardFiltersProvider widgets={[widget]}>
        <WidgetSlot
          widgetId={widget.id}
          widgetIndex={0}
          experimentId="exp-1"
          isSelected={isSelected}
          onSelect={onSelect}
        />
      </DashboardFiltersProvider>
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "Dash",
          description: "",
          layout: { columns: 12, rowHeight: 80, gap: 16 },
          widgets: [widget],
        },
      },
    },
  );
}

describe("WidgetSlot", () => {
  it("renders the widget card with the widget content visible", () => {
    setup();
    expect(screen.getByText(/hello world/)).toBeInTheDocument();
  });

  it("exposes aria-current=true when selected", () => {
    const { container } = setup({ isSelected: true });
    const card = container.querySelector("[data-dashboard-widget]");
    expect(card).toHaveAttribute("aria-current", "true");
  });

  it("invokes onSelect with the widget id when the card is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { container } = setup({ onSelect });
    const card = container.querySelector<HTMLDivElement>("[data-dashboard-widget]");
    expect(card).not.toBeNull();
    if (!card) return;
    await user.click(card);
    expect(onSelect).toHaveBeenCalledWith("rt-w1");
  });

  it("renders nothing when the watched index points at a different widget (stale slot)", () => {
    // Setup with a widget at index 0 but ask the slot for a different id.
    const result = renderWithForm<DashboardFormValues>(
      () => (
        <DashboardFiltersProvider widgets={[richTextWidget]}>
          <WidgetSlot
            widgetId="different-id"
            widgetIndex={0}
            experimentId="exp-1"
            isSelected={false}
            onSelect={vi.fn()}
          />
        </DashboardFiltersProvider>
      ),
      {
        useFormProps: {
          defaultValues: {
            name: "Dash",
            description: "",
            layout: { columns: 12, rowHeight: 80, gap: 16 },
            widgets: [richTextWidget],
          },
        },
      },
    );
    // No widget card rendered because the id mismatch returns null.
    expect(result.container).toBeEmptyDOMElement();
  });

  it("renders a table widget through the editor when given one (no API errors)", () => {
    // The table editor pulls table data; mount empty defaults so the request resolves.
    server.mount(contract.experiments.getExperimentData, {
      body: [
        {
          name: "raw_data",
          catalog_name: "c",
          schema_name: "s",
          totalRows: 0,
          page: 1,
          pageSize: 1,
          totalPages: 0,
          data: { columns: [], rows: [], totalRows: 0, truncated: false },
        },
      ],
    });
    const tableWidget: ExperimentDashboardWidget = {
      id: "tbl-w1",
      type: "table",
      layout: { col: 0, row: 0, colSpan: 6, rowSpan: 4 },
      // No tableName: editor renders the "pickTable" empty state, which is the
      // initial state for a freshly placed widget.
      config: { pageSize: 25, showTitle: true, showDescription: true },
    };
    setup({ widget: tableWidget });
    expect(screen.getByText("editor.tableConfig.pickTable")).toBeInTheDocument();
  });
});
