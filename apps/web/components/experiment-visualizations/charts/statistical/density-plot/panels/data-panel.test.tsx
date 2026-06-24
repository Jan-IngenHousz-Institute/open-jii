import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { densityPlotChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { DensityPlotDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: densityPlotChartType.family,
    chartType: densityPlotChartType.type,
    config: densityPlotChartType.defaultConfig(),
    dataConfig: densityPlotChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "value2", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "grp", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <DensityPlotDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("DensityPlotDataPanel", () => {
  it("renders the variables, color, and facet shelves (no X)", () => {
    renderPanel();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.variables" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.groupBy" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.facetDimension" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "workspace.shelves.xAxis" }),
    ).not.toBeInTheDocument();
  });

  it("seeds the first variable from the existing y data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [{ tableName: "data", columnName: "value", role: "y" }],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("value");
  });

  it("writes the picked variable column into the y data source", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [{ tableName: "data", columnName: "", role: "y" }],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("value"));

    const ySource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "y");
    expect(ySource).toEqual(expect.objectContaining({ columnName: "value", tableName: "data" }));
  });

  it("appends a new variable when Add series is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [{ tableName: "data", columnName: "value", role: "y" }],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: "workspace.shelves.addSeries" }));
    const ySources = form.getValues("dataConfig.dataSources").filter((ds) => ds.role === "y");
    expect(ySources.length).toBeGreaterThanOrEqual(2);
  });
});
