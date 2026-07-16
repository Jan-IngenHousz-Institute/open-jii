import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { radarChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { RadarDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: radarChartType.family,
    chartType: radarChartType.type,
    config: radarChartType.defaultConfig(),
    dataConfig: radarChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "a", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "b", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "c", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "grp", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <RadarDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("RadarDataPanel", () => {
  it("renders the radar axes and color shelves", () => {
    renderPanel();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.radarAxes" }),
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
            { tableName: "data", columnName: "c", role: "y" },
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
          dataSources: [
            { tableName: "data", columnName: "a", role: "y" },
            { tableName: "data", columnName: "b", role: "y" },
            { tableName: "data", columnName: "c", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: "workspace.shelves.addSeries" }));
    const ySources = form.getValues("dataConfig.dataSources").filter((ds) => ds.role === "y");
    expect(ySources.length).toBeGreaterThanOrEqual(4);
  });
});
