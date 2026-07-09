import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { parallelCoordinatesChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { ParallelCoordinatesDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: parallelCoordinatesChartType.family,
    chartType: parallelCoordinatesChartType.type,
    config: parallelCoordinatesChartType.defaultConfig(),
    dataConfig: parallelCoordinatesChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "a", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "b", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "grp", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <ParallelCoordinatesDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("ParallelCoordinatesDataPanel", () => {
  it("renders the parcoords axes and color shelves", () => {
    renderPanel();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.parcoordsAxes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.groupBy" })).toBeInTheDocument();
  });

  it("seeds the first axis trigger from the existing y data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "a", role: "y" },
            { tableName: "data", columnName: "b", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("a");
  });

  it("writes the picked axis column into the y data source", async () => {
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
    await user.click(await screen.findByText("a"));

    const ySource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "y");
    expect(ySource).toEqual(expect.objectContaining({ columnName: "a", tableName: "data" }));
  });

  it("appends a new axis when Add series is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [{ tableName: "data", columnName: "a", role: "y" }],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: "workspace.shelves.addSeries" }));
    const ySources = form.getValues("dataConfig.dataSources").filter((ds) => ds.role === "y");
    expect(ySources.length).toBeGreaterThanOrEqual(2);
  });
});
