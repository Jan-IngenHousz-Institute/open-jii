import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { violinPlotChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { ViolinPlotDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: violinPlotChartType.family,
    chartType: violinPlotChartType.type,
    config: violinPlotChartType.defaultConfig(),
    dataConfig: violinPlotChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "group", type_name: "STRING", type_text: "STRING" },
  { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "value2", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "hue", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <ViolinPlotDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("ViolinPlotDataPanel", () => {
  it("renders X, variables, color, and facet shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.xAxis" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.variables" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.groupBy" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.facetDimension" }),
    ).toBeInTheDocument();
  });

  it("hides the X axis-type picker (violin forces categorical)", () => {
    renderPanel();
    expect(screen.queryByText("workspace.shelves.axisType")).not.toBeInTheDocument();
  });

  it("seeds the X-axis trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "obs",
          dataSources: [
            { tableName: "obs", columnName: "group", role: "x" },
            { tableName: "obs", columnName: "value", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("group");
  });

  it("writes the picked variable into the y data source", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "obs",
          dataSources: [
            { tableName: "obs", columnName: "group", role: "x" },
            { tableName: "obs", columnName: "", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByText("value"));

    const ySource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "y");
    expect(ySource).toEqual(expect.objectContaining({ columnName: "value", tableName: "obs" }));
  });

  it("appends a new variable when Add series is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "obs",
          dataSources: [
            { tableName: "obs", columnName: "group", role: "x" },
            { tableName: "obs", columnName: "value", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: "workspace.shelves.addSeries" }));
    const ySources = form.getValues("dataConfig.dataSources").filter((ds) => ds.role === "y");
    expect(ySources.length).toBeGreaterThanOrEqual(2);
  });
});
