import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { polarChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { PolarDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: polarChartType.family,
    chartType: polarChartType.type,
    config: polarChartType.defaultConfig(),
    dataConfig: polarChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "theta", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "r", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "r2", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "grp", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <PolarDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("PolarDataPanel", () => {
  it("renders theta, radial, and color shelves", () => {
    renderPanel();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.polarTheta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.polarRadial" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.groupBy" })).toBeInTheDocument();
  });

  it("seeds the theta column from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "theta", role: "x" },
            { tableName: "data", columnName: "r", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("theta");
  });

  it("writes the picked theta column into the x data source", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "", role: "x" },
            { tableName: "data", columnName: "r", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("theta"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "theta", tableName: "data" }));
  });

  it("appends a new radial axis when Add series is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "theta", role: "x" },
            { tableName: "data", columnName: "r", role: "y" },
          ],
        },
      }),
    );

    const initialCount = form
      .getValues("dataConfig.dataSources")
      .filter((ds) => ds.role === "y").length;
    await user.click(screen.getByRole("button", { name: "workspace.shelves.addSeries" }));
    const ySources = form.getValues("dataConfig.dataSources").filter((ds) => ds.role === "y");
    expect(ySources).toHaveLength(initialCount + 1);
  });
});
