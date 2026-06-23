import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { carpetChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { CarpetDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: carpetChartType.family,
    chartType: carpetChartType.type,
    config: carpetChartType.defaultConfig(),
    dataConfig: carpetChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "a", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "b", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "z", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <CarpetDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("CarpetDataPanel", () => {
  it("renders X, Y, and Z shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.xAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.yAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.zAxis" })).toBeInTheDocument();
  });

  it("hides axis-type pickers on both X and Y (carpet forces them)", () => {
    renderPanel();
    expect(screen.queryByText("workspace.shelves.axisType")).not.toBeInTheDocument();
  });

  it("seeds the X-axis trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "grid",
          dataSources: [
            { tableName: "grid", columnName: "a", role: "x" },
            { tableName: "grid", columnName: "b", role: "y" },
            { tableName: "grid", columnName: "z", role: "z" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("a");
  });

  it("writes the picked X column into the data sources", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "grid",
          dataSources: [
            { tableName: "grid", columnName: "", role: "x" },
            { tableName: "grid", columnName: "b", role: "y" },
            { tableName: "grid", columnName: "z", role: "z" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("a"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "a", tableName: "grid" }));
  });

  it("hides the Add series button (single-series Y)", () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "workspace.shelves.addSeries" }),
    ).not.toBeInTheDocument();
  });
});
