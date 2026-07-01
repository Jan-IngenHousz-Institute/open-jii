import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { alluvialChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { AlluvialDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: alluvialChartType.family,
    chartType: alluvialChartType.type,
    config: alluvialChartType.defaultConfig(),
    dataConfig: alluvialChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "stage1", type_name: "STRING", type_text: "STRING" },
  { name: "stage2", type_name: "STRING", type_text: "STRING" },
  { name: "stage3", type_name: "STRING", type_text: "STRING" },
  { name: "amount", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <AlluvialDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("AlluvialDataPanel", () => {
  it("renders the stages and value shelves", () => {
    renderPanel();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.alluvialStages" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.alluvialValue" }),
    ).toBeInTheDocument();
  });

  it("seeds stages with existing groupBy data sources", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "flow",
          dataSources: [
            { tableName: "flow", columnName: "stage1", role: "groupBy" },
            { tableName: "flow", columnName: "stage2", role: "groupBy" },
            { tableName: "flow", columnName: "amount", role: "value" },
          ],
        },
      }),
    );
    const combos = screen.getAllByRole("combobox");
    expect(combos[0]).toHaveTextContent("stage1");
    expect(combos[1]).toHaveTextContent("stage2");
  });

  it("appends a new stage when Add series is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "flow",
          dataSources: [
            { tableName: "flow", columnName: "stage1", role: "groupBy" },
            { tableName: "flow", columnName: "stage2", role: "groupBy" },
            { tableName: "flow", columnName: "amount", role: "value" },
          ],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: "workspace.shelves.addSeries" }));
    const groupBys = form.getValues("dataConfig.dataSources").filter((ds) => ds.role === "groupBy");
    expect(groupBys.length).toBe(3);
  });

  it("writes the picked value column into the value data source", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "flow",
          dataSources: [
            { tableName: "flow", columnName: "stage1", role: "groupBy" },
            { tableName: "flow", columnName: "stage2", role: "groupBy" },
            { tableName: "flow", columnName: "", role: "value" },
          ],
        },
      }),
    );

    const combos = screen.getAllByRole("combobox");
    await user.click(combos[combos.length - 1]);
    await user.click(await screen.findByText("amount"));

    const valueSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "value");
    expect(valueSource).toEqual(
      expect.objectContaining({ columnName: "amount", tableName: "flow" }),
    );
  });
});
