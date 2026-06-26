import { createExperimentDataTable, createFilterWidget } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DashboardFiltersProvider } from "../../dashboard-filters-context";
import { FilterWidgetView } from "./filter-widget-view";

function mountColumns(tableName: string) {
  server.mount(contract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        name: tableName,
        data: {
          columns: [
            { name: "device_id", type_name: "STRING", type_text: "STRING" },
            { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
          rows: [],
          totalRows: 0,
          truncated: false,
        },
      }),
    ],
  });
  server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values: ["d1", "d2"], truncated: false },
  });
}

describe("FilterWidgetView", () => {
  it("shows the empty state when the widget is in its draft (unconfigured) state", () => {
    const widget = createFilterWidget({
      config: { showTitle: true, showDescription: true },
    });
    render(
      <DashboardFiltersProvider widgets={[widget]}>
        <FilterWidgetView widget={widget} experimentId="exp-1" />
      </DashboardFiltersProvider>,
    );
    expect(screen.getByText("widget.emptyFilter")).toBeInTheDocument();
  });

  it("renders the resolved column title and operator label when fully configured", async () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: false,
        tableName: "raw_data",
        column: "value",
        operator: "greater_than",
        defaultValue: 5,
      },
    });

    render(
      <DashboardFiltersProvider widgets={[widget]}>
        <FilterWidgetView widget={widget} experimentId="exp-1" />
      </DashboardFiltersProvider>,
    );
    expect(await screen.findByRole("heading", { name: "value" })).toBeInTheDocument();
    // Numeric "greater_than" renders the raw symbol from the numeric op set.
    expect(screen.getByText(">")).toBeInTheDocument();
  });

  it("hides the title row when showTitle is off", () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: false,
        showDescription: false,
        tableName: "raw_data",
        column: "value",
        operator: "equals",
        defaultValue: 1,
      },
    });
    render(
      <DashboardFiltersProvider widgets={[widget]}>
        <FilterWidgetView widget={widget} experimentId="exp-1" />
      </DashboardFiltersProvider>,
    );
    expect(screen.queryByRole("heading", { name: "value" })).not.toBeInTheDocument();
  });

  it("surfaces the reset button only after the viewer overrides the saved value", async () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: false,
        tableName: "raw_data",
        column: "value",
        operator: "equals",
        defaultValue: 5,
      },
    });
    const user = userEvent.setup();
    render(
      <DashboardFiltersProvider widgets={[widget]}>
        <FilterWidgetView widget={widget} experimentId="exp-1" />
      </DashboardFiltersProvider>,
    );

    expect(screen.queryByRole("button", { name: /widget.filterReset/ })).not.toBeInTheDocument();

    const input = await screen.findByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "9");

    expect(screen.getByRole("button", { name: /widget.filterReset/ })).toBeInTheDocument();
  });
});
