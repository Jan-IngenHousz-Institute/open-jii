import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { spcControlChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { SPCDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: spcControlChartType.family,
    chartType: spcControlChartType.type,
    config: spcControlChartType.defaultConfig(),
    dataConfig: spcControlChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "t", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <SPCDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("SPCDataPanel", () => {
  it("renders X and Y shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.xAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.yAxis" })).toBeInTheDocument();
  });

  it("does not expose the time-bucket dropdown (X temporal but bucket hidden)", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "obs",
          dataSources: [
            { tableName: "obs", columnName: "t", role: "x" },
            { tableName: "obs", columnName: "value", role: "y" },
          ],
        },
      }),
    );
    expect(screen.queryByText("workspace.shelves.timeBucket")).not.toBeInTheDocument();
  });

  it("does not expose the Y aggregate (SPC computes raw stats client-side)", () => {
    renderPanel();
    expect(screen.queryByText("workspace.shelves.aggregate")).not.toBeInTheDocument();
  });

  it("seeds the X-axis trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "obs",
          dataSources: [
            { tableName: "obs", columnName: "t", role: "x" },
            { tableName: "obs", columnName: "value", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("t");
  });

  it("writes the picked X column into the data sources", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "obs",
          dataSources: [
            { tableName: "obs", columnName: "", role: "x" },
            { tableName: "obs", columnName: "value", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("t"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "t", tableName: "obs" }));
  });

  it("hides the Add series button (single-series Y)", () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "workspace.shelves.addSeries" }),
    ).not.toBeInTheDocument();
  });
});
