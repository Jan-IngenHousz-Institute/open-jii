import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { lollipopChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { LollipopDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lollipopChartType.family,
    chartType: lollipopChartType.type,
    config: lollipopChartType.defaultConfig(),
    dataConfig: lollipopChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "category", type_name: "STRING", type_text: "STRING" },
  { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <LollipopDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("LollipopDataPanel", () => {
  it("renders X and Y shelves (no group-by, no facet)", () => {
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

  it("hides the X-axis type picker (lollipop forces categorical) and keeps Y's", () => {
    renderPanel();
    expect(screen.getAllByText("workspace.shelves.axisType")).toHaveLength(1);
  });

  it("hides the Add series button (single-series only)", () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "workspace.shelves.addSeries" }),
    ).not.toBeInTheDocument();
  });

  it("seeds the X-axis trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "obs",
          dataSources: [
            { tableName: "obs", columnName: "category", role: "x" },
            { tableName: "obs", columnName: "value", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("category");
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
    await user.click(await screen.findByText("category"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "category", tableName: "obs" }));
  });
});
