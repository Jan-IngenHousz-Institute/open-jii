import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { ZShelf } from "./z-shelf";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "x_col", role: "x" },
        { tableName: "readings", columnName: "y_col", role: "y" },
        { tableName: "readings", columnName: "z_col", role: "z" },
      ],
    },
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "x_col", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y_col", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "z_col", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "alt", type_name: "DOUBLE", type_text: "DOUBLE" },
];

describe("ZShelf", () => {
  it("renders the heading + column + aggregate controls", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <ZShelf
          form={form}
          columns={columns}
          heading="Cell value"
          xColumn="x_col"
          yColumn="y_col"
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByRole("heading", { name: "Cell value" })).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.column")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.aggregate")).toBeInTheDocument();
  });

  it("uses the existing z data source's column as the picker's current value", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <ZShelf form={form} columns={columns} heading="Z" xColumn="x_col" yColumn="y_col" />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByRole("combobox", { name: "workspace.shelves.column" })).toHaveTextContent(
      "z_col",
    );
  });

  it("writes the new column choice back into the z data source", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <ZShelf form={form} columns={columns} heading="Z" xColumn="x_col" yColumn="y_col" />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("alt"));

    const sources = form.getValues("dataConfig.dataSources");
    expect(sources.find((d) => d.role === "z")?.columnName).toBe("alt");
  });

  it("exposes the five Z aggregate options in the dropdown", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>(
      (form) => (
        <ZShelf form={form} columns={columns} heading="Z" xColumn="x_col" yColumn="y_col" />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    const aggregateTrigger = screen.getAllByRole("combobox")[1];
    await user.click(aggregateTrigger);

    expect(await screen.findByText("Average")).toBeInTheDocument();
    expect(screen.getByText("Sum")).toBeInTheDocument();
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();
    expect(screen.getByText("Count")).toBeInTheDocument();
  });

  it("falls back to source index 0 when there is no existing z data source", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <ZShelf form={form} columns={columns} heading="Z" xColumn="x_col" yColumn="y_col" />
      ),
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "x_col", role: "x" }],
            },
          }),
        },
      },
    );
    // Trigger renders, no crash.
    expect(screen.getByRole("combobox", { name: "workspace.shelves.column" })).toBeInTheDocument();
  });
});
