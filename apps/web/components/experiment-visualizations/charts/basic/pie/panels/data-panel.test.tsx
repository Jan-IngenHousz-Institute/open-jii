import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { pieChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { PieDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: pieChartType.family,
    chartType: pieChartType.type,
    config: pieChartType.defaultConfig(),
    dataConfig: pieChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "category", type_name: "STRING", type_text: "STRING" },
  { name: "amount", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>((form) => <PieDataPanel form={form} columns={columns} />, {
    useFormProps: { defaultValues: formDefaults ?? defaults() },
  });
}

describe("PieDataPanel", () => {
  it("renders the labels and values shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.labels" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.values" })).toBeInTheDocument();
  });

  it("seeds the labels trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "sales",
          dataSources: [
            { tableName: "sales", columnName: "category", role: "labels" },
            { tableName: "sales", columnName: "amount", role: "values" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("category");
  });

  it("writes the picked labels column into the data sources and groupBy", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "sales",
          dataSources: [
            { tableName: "sales", columnName: "", role: "labels" },
            { tableName: "sales", columnName: "amount", role: "values" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("category"));

    const labelSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "labels");
    expect(labelSource).toEqual(
      expect.objectContaining({ columnName: "category", tableName: "sales" }),
    );
    expect(form.getValues("dataConfig.aggregation")?.groupBy).toEqual([{ column: "category" }]);
  });

  it("writes the picked values column and seeds Sum as the default aggregate", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "sales",
          dataSources: [
            { tableName: "sales", columnName: "category", role: "labels" },
            { tableName: "sales", columnName: "", role: "values" },
          ],
        },
      }),
    );

    const combos = screen.getAllByRole("combobox");
    await user.click(combos[1]);
    await user.click(await screen.findByText("amount"));

    expect(form.getValues("dataConfig.aggregation")?.functions).toEqual([
      { column: "amount", function: "sum" },
    ]);
  });

  it("shows the count hint when the aggregate is count", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "sales",
          dataSources: [
            { tableName: "sales", columnName: "category", role: "labels" },
            { tableName: "sales", columnName: "", role: "values" },
          ],
          aggregation: {
            groupBy: [{ column: "category" }],
            functions: [{ column: "*", function: "count" }],
          },
        },
      }),
    );
    expect(screen.getByText("workspace.shelves.pieValuesCountHint")).toBeInTheDocument();
  });
});
