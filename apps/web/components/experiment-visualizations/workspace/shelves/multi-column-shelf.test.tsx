import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import type { ReactElement } from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { DataSourcesFieldArrayProvider } from "../context/data-sources-field-array-context";
import { MultiColumnShelf } from "./multi-column-shelf";

type RenderFn = (form: UseFormReturn<ChartFormValues>) => ReactElement;
type Opts = Parameters<typeof renderWithForm<ChartFormValues>>[1];

function renderShelf(render: RenderFn, options: Opts) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>{render(form)}</DataSourcesFieldArrayProvider>
    ),
    options,
  );
}

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: {
      tableName: "readings",
      dataSources: [{ tableName: "readings", columnName: "a", role: "y" }],
    },
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "a", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "b", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "c", type_name: "DOUBLE", type_text: "DOUBLE" },
];

describe("MultiColumnShelf", () => {
  it("renders one series block per data source for the role", () => {
    renderShelf(
      (form) => (
        <MultiColumnShelf
          form={form}
          columns={columns}
          role="y"
          heading="Values"
          columnLabel="workspace.shelves.column"
          placeholder="pick"
        />
      ),
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [
                { tableName: "readings", columnName: "a", role: "y" },
                { tableName: "readings", columnName: "b", role: "y" },
              ],
            },
          }),
        },
      },
    );

    expect(screen.getAllByText("workspace.shelves.series")).toHaveLength(2);
  });

  it("appends another data source when 'add series' is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      (form) => (
        <MultiColumnShelf
          form={form}
          columns={columns}
          role="y"
          heading="Values"
          columnLabel="workspace.shelves.column"
          placeholder="pick"
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.addSeries/ }));
    const ySeries = form.getValues("dataConfig.dataSources").filter((d) => d.role === "y");
    expect(ySeries).toHaveLength(2);
  });

  it("hides the 'add series' button once maxSeries is reached", () => {
    renderShelf(
      (form) => (
        <MultiColumnShelf
          form={form}
          columns={columns}
          role="y"
          heading="Values"
          columnLabel="workspace.shelves.column"
          placeholder="pick"
          maxSeries={1}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(
      screen.queryByRole("button", { name: /workspace\.shelves\.addSeries/ }),
    ).not.toBeInTheDocument();
  });

  it("hides the remove button when the count is at minSeries", () => {
    renderShelf(
      (form) => (
        <MultiColumnShelf
          form={form}
          columns={columns}
          role="y"
          heading="Values"
          columnLabel="workspace.shelves.column"
          placeholder="pick"
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(
      screen.queryByRole("button", { name: "workspace.shelves.removeSeries" }),
    ).not.toBeInTheDocument();
  });

  it("removes the targeted data source when its row's remove button is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      (form) => (
        <MultiColumnShelf
          form={form}
          columns={columns}
          role="y"
          heading="Values"
          columnLabel="workspace.shelves.column"
          placeholder="pick"
        />
      ),
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [
                { tableName: "readings", columnName: "a", role: "y" },
                { tableName: "readings", columnName: "b", role: "y" },
              ],
            },
          }),
        },
      },
    );

    const removeButtons = screen.getAllByRole("button", { name: "workspace.shelves.removeSeries" });
    await user.click(removeButtons[0]);

    const ySeries = form.getValues("dataConfig.dataSources").filter((d) => d.role === "y");
    expect(ySeries).toHaveLength(1);
    expect(ySeries[0].columnName).toBe("b");
  });

  it("renders per-series color inputs when showSeriesColor is enabled", () => {
    renderShelf(
      (form) => (
        <MultiColumnShelf
          form={form}
          columns={columns}
          role="y"
          heading="Values"
          columnLabel="workspace.shelves.column"
          placeholder="pick"
          showSeriesColor
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.shelves.color")).toBeInTheDocument();
  });

  it("seeds a fresh color for the new series when add-series fires (array color path)", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      (form) => (
        <MultiColumnShelf
          form={form}
          columns={columns}
          role="y"
          heading="Values"
          columnLabel="workspace.shelves.column"
          placeholder="pick"
          showSeriesColor
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.addSeries/ }));

    const colors = form.getValues("config.color");
    expect(Array.isArray(colors)).toBe(true);
    expect(Array.isArray(colors) && colors.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT touch config.color when showSeriesColor is false on add-series", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      (form) => (
        <MultiColumnShelf
          form={form}
          columns={columns}
          role="y"
          heading="Values"
          columnLabel="workspace.shelves.column"
          placeholder="pick"
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    const before = form.getValues("config.color");
    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.addSeries/ }));
    expect(form.getValues("config.color")).toEqual(before);
  });

  it("stamps the alias from the column name when showAlias is enabled", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      (form) => (
        <MultiColumnShelf
          form={form}
          columns={columns}
          role="y"
          heading="Values"
          columnLabel="workspace.shelves.column"
          placeholder="pick"
          showAlias
        />
      ),
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "", role: "y" }],
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("b"));

    expect(form.getValues("dataConfig.dataSources.0.alias")).toBe("b");
  });
});
