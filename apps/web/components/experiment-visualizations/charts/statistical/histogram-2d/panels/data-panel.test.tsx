import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { histogram2DChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { Histogram2DDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: histogram2DChartType.family,
    chartType: histogram2DChartType.type,
    config: histogram2DChartType.defaultConfig(),
    dataConfig: histogram2DChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "x", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <Histogram2DDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("Histogram2DDataPanel", () => {
  it("renders X and Y shelves only", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.xAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.yAxis" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "workspace.shelves.groupBy" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "workspace.shelves.facetDimension" }),
    ).not.toBeInTheDocument();
  });

  it("hides axis-type pickers and aggregate (histogram2d bins raw rows)", () => {
    renderPanel();
    expect(screen.queryByText("workspace.shelves.axisType")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.shelves.aggregate")).not.toBeInTheDocument();
  });

  it("seeds the X-axis trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "pts",
          dataSources: [
            { tableName: "pts", columnName: "x", role: "x" },
            { tableName: "pts", columnName: "y", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("x");
  });

  it("writes the picked X column into the data sources", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "pts",
          dataSources: [
            { tableName: "pts", columnName: "", role: "x" },
            { tableName: "pts", columnName: "y", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("x"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "x", tableName: "pts" }));
  });

  it("hides the Add series button (single-series Y)", () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "workspace.shelves.addSeries" }),
    ).not.toBeInTheDocument();
  });
});
