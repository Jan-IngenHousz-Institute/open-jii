import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { ternaryChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { TernaryDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: ternaryChartType.family,
    chartType: ternaryChartType.type,
    config: ternaryChartType.defaultConfig(),
    dataConfig: ternaryChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "a", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "b", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "c", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "grp", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <TernaryDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("TernaryDataPanel", () => {
  it("renders A, B, C, and color shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.ternaryA" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.ternaryB" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.ternaryC" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.colorDimension" }),
    ).toBeInTheDocument();
  });

  it("seeds the A trigger from the existing x data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "a", role: "x" },
            { tableName: "data", columnName: "b", role: "y" },
            { tableName: "data", columnName: "c", role: "z" },
          ],
        },
      }),
    );
    const combos = screen.getAllByRole("combobox");
    expect(combos[0]).toHaveTextContent("a");
    expect(combos[1]).toHaveTextContent("b");
    expect(combos[2]).toHaveTextContent("c");
  });

  it("writes the picked A column into the x data source", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "", role: "x" },
            { tableName: "data", columnName: "b", role: "y" },
            { tableName: "data", columnName: "c", role: "z" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("a"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "a", tableName: "data" }));
  });

  it("writes the picked C column into the z data source", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "a", role: "x" },
            { tableName: "data", columnName: "b", role: "y" },
            { tableName: "data", columnName: "", role: "z" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[2]);
    await user.click(await screen.findByText("c"));

    const zSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "z");
    expect(zSource).toEqual(expect.objectContaining({ columnName: "c", tableName: "data" }));
  });
});
