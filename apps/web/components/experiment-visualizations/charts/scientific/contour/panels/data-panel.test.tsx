import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { contourChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { ContourDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: contourChartType.family,
    chartType: contourChartType.type,
    config: contourChartType.defaultConfig(),
    dataConfig: contourChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "x", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "z", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <ContourDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("ContourDataPanel", () => {
  it("renders X, Y, and Z (level) shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.xAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.yAxis" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.zAxisLevel" }),
    ).toBeInTheDocument();
  });

  it("hides axis-type pickers on both X and Y", () => {
    renderPanel();
    expect(screen.queryByText("workspace.shelves.axisType")).not.toBeInTheDocument();
  });

  it("seeds the Y-axis trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "grid",
          dataSources: [
            { tableName: "grid", columnName: "x", role: "x" },
            { tableName: "grid", columnName: "y", role: "y" },
            { tableName: "grid", columnName: "z", role: "z" },
          ],
        },
      }),
    );
    const combos = screen.getAllByRole("combobox");
    expect(combos[1]).toHaveTextContent("y");
  });

  it("writes the picked X column into the data sources", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "grid",
          dataSources: [
            { tableName: "grid", columnName: "", role: "x" },
            { tableName: "grid", columnName: "y", role: "y" },
            { tableName: "grid", columnName: "z", role: "z" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("x"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "x", tableName: "grid" }));
  });

  it("hides the Add series button (single-series Y)", () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "workspace.shelves.addSeries" }),
    ).not.toBeInTheDocument();
  });
});
