import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { densityPlot2DChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { DensityPlot2DDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: densityPlot2DChartType.family,
    chartType: densityPlot2DChartType.type,
    config: densityPlot2DChartType.defaultConfig(),
    dataConfig: densityPlot2DChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "x", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <DensityPlot2DDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("DensityPlot2DDataPanel", () => {
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

  it("hides axis-type pickers and aggregate (density2d bins raw rows)", () => {
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
