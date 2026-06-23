import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { pieChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { PieLabelsShelf } from "./labels-shelf";

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
  { name: "region", type_name: "STRING", type_text: "STRING" },
];

function renderShelf(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <PieLabelsShelf form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("PieLabelsShelf", () => {
  it("renders heading and column picker", () => {
    renderShelf();
    expect(screen.getByRole("heading", { name: "workspace.shelves.labels" })).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.column")).toBeInTheDocument();
  });

  it("writes the picked column into the labels data source", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
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

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("category"));

    const labelSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "labels");
    expect(labelSource).toEqual(
      expect.objectContaining({ columnName: "category", tableName: "sales" }),
    );
  });

  it("sets aggregation.groupBy to the picked column", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
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

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("region"));

    expect(form.getValues("dataConfig.aggregation")?.groupBy).toEqual([{ column: "region" }]);
  });

  it("preserves existing functions when groupBy is overwritten", async () => {
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

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("region"));

    expect(form.getValues("dataConfig.aggregation")?.functions).toEqual([
      { column: "amount", function: "sum" },
    ]);
  });

  it("seeds the trigger from the existing labels data source", () => {
    renderShelf(
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
    expect(screen.getByRole("combobox")).toHaveTextContent("category");
  });
});
