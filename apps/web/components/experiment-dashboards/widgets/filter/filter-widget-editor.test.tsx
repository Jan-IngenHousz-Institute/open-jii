import { createExperimentDataTable, createFilterWidget } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import { FilterWidgetEditor } from "./filter-widget-editor";

function mountColumns(tableName: string) {
  server.mount(orpcContract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        name: tableName,
        data: {
          columns: [{ name: "value", type_name: "DOUBLE", type_text: "DOUBLE" }],
          rows: [],
          totalRows: 0,
          truncated: false,
        },
      }),
    ],
  });
}

function renderEditor(widget: ReturnType<typeof createFilterWidget>) {
  let current: DashboardFormValues = {
    name: "Dashboard",
    description: "",
    layout: { columns: 12, rowHeight: 80, gap: 16 },
    widgets: [widget],
  };
  renderWithForm<DashboardFormValues>(
    (form) => {
      current = form.watch();
      return <FilterWidgetEditor widget={widget} experimentId="exp-1" widgetIndex={0} />;
    },
    { useFormProps: { defaultValues: current } },
  );
  return {
    defaultValue: () => {
      const w = current.widgets[0];
      return w.type === "filter" ? w.config.defaultValue : undefined;
    },
  };
}

describe("FilterWidgetEditor", () => {
  it("renders the editor's configure hint when the widget is in its draft state", () => {
    const widget = createFilterWidget({
      config: { showTitle: true, showDescription: true },
    });
    renderEditor(widget);
    expect(screen.getByText("editor.filterConfig.configureLabel")).toBeInTheDocument();
  });

  it("renders the default value input once the widget is fully configured", async () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: true,
        tableName: "raw_data",
        column: "value",
        operator: "equals",
        defaultValue: 5,
      },
    });
    renderEditor(widget);
    expect(await screen.findByRole("spinbutton")).toHaveValue(5);
    expect(screen.getByText("editor.filterConfig.defaultValueHint")).toBeInTheDocument();
  });

  it("writes edits through to the form's widget.config.defaultValue", async () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: true,
        tableName: "raw_data",
        column: "value",
        operator: "equals",
        defaultValue: 1,
      },
    });
    const handle = renderEditor(widget);
    const user = userEvent.setup();

    const input = await screen.findByRole("spinbutton");
    // Numeric input is controlled by `widget.config.defaultValue`, which is the
    // (frozen) prop; appending one digit is enough to verify the form sink.
    await user.type(input, "9");

    expect(handle.defaultValue()).toBe(19);
  });

  it("renders the title and operator label once configured", () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: true,
        tableName: "raw_data",
        column: "value",
        operator: "greater_than",
        title: "Value filter",
      },
    });
    renderEditor(widget);
    expect(screen.getByText("Value filter")).toBeInTheDocument();
    expect(screen.getByText(">")).toBeInTheDocument();
  });
});
