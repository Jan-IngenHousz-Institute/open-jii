import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { pieChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { PieValuesShelf } from "./values-shelf";

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

const columns: DataColumn[] = [
  { name: "amount", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "weight", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderShelf(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <PieValuesShelf form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("PieValuesShelf", () => {
  it("renders heading, column picker, and aggregate dropdown", () => {
    renderShelf();
    expect(screen.getByRole("heading", { name: "workspace.shelves.values" })).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.column")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.aggregate")).toBeInTheDocument();
  });

  it("writes the picked column + Sum aggregate into the aggregation config", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
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

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("amount"));

    expect(form.getValues("dataConfig.aggregation")?.functions).toEqual([
      { column: "amount", function: "sum" },
    ]);
  });

  it("rewrites the function when the aggregate changes", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      defaults({
        dataConfig: {
          tableName: "sales",
          dataSources: [
            { tableName: "sales", columnName: "category", role: "labels" },
            { tableName: "sales", columnName: "amount", role: "values" },
          ],
          aggregation: {
            groupBy: [{ column: "category" }],
            functions: [{ column: "amount", function: "sum" }],
          },
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByText("Average"));

    expect(form.getValues("dataConfig.aggregation")?.functions).toEqual([
      { column: "amount", function: "avg" },
    ]);
  });

  it("falls back to COUNT(*) when count is selected without a values column", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      defaults({
        dataConfig: {
          tableName: "sales",
          dataSources: [
            { tableName: "sales", columnName: "category", role: "labels" },
            { tableName: "sales", columnName: "", role: "values" },
          ],
          aggregation: {
            groupBy: [{ column: "category" }],
          },
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByText("Count"));

    expect(form.getValues("dataConfig.aggregation")?.functions).toEqual([
      { column: "*", function: "count" },
    ]);
  });

  it("drops the function entry when switching off Count without a values column", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
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

    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByText("Sum"));

    expect(form.getValues("dataConfig.aggregation")).toEqual({
      groupBy: [{ column: "category" }],
    });
  });

  it("surfaces the count hint when current function is count", () => {
    renderShelf(
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
