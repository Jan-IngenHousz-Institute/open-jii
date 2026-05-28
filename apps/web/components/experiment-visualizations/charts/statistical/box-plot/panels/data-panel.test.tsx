import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { boxPlotChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { BoxPlotDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: boxPlotChartType.family,
    chartType: boxPlotChartType.type,
    config: boxPlotChartType.defaultConfig(),
    dataConfig: boxPlotChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "group", type_name: "STRING", type_text: "STRING" },
  { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "hue", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <BoxPlotDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("BoxPlotDataPanel", () => {
  it("renders X, Y, color, and facet shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.xAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.yAxis" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.colorDimension" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.facetDimension" }),
    ).toBeInTheDocument();
  });

  it("hides X axis-type and Y axis-type + aggregate (box trace bins client-side)", () => {
    renderPanel();
    expect(screen.queryByText("workspace.shelves.axisType")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.shelves.aggregate")).not.toBeInTheDocument();
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

  it("writes the picked Y column into the data sources", async () => {
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

  it("exposes the Add series button on the Y shelf", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "workspace.shelves.addSeries" })).toBeInTheDocument();
  });
});
