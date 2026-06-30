import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { FiltersShelf } from "./filters-shelf";

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
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "temp", role: "y" },
      ],
    },
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "site", type_name: "STRING", type_text: "STRING" },
  { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function mountDistinct() {
  server.mount(orpcContract.experiments.getDistinctColumnValues, {
    body: { values: [], truncated: false },
  });
}

describe("FiltersShelf", () => {
  it("renders the section heading and starts collapsed", () => {
    mountDistinct();
    renderWithForm<ChartFormValues>(
      (form) => (
        <FiltersShelf form={form} columns={columns} experimentId="exp-1" tableName="readings" />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByRole("heading", { name: "workspace.shelves.filters" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "dataFilters.addFilter" })).not.toBeInTheDocument();
  });

  it("expands to show the filter chip list (with add button) when toggled", async () => {
    mountDistinct();
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>(
      (form) => (
        <FiltersShelf form={form} columns={columns} experimentId="exp-1" tableName="readings" />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.filters/ }));
    expect(
      await screen.findByRole("button", { name: "dataFilters.addFilter" }),
    ).toBeInTheDocument();
  });

  it("shows the filter count badge when filters exist", () => {
    mountDistinct();
    renderWithForm<ChartFormValues>(
      (form) => (
        <FiltersShelf form={form} columns={columns} experimentId="exp-1" tableName="readings" />
      ),
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "temp", role: "y" }],
              filters: [
                { column: "site", operator: "equals", value: "alpha" },
                { column: "value", operator: "greater_than", value: 5 },
              ],
            },
          }),
        },
      },
    );

    // Header shows the active count.
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("does not render the count badge when no filters are set", () => {
    mountDistinct();
    renderWithForm<ChartFormValues>(
      (form) => (
        <FiltersShelf form={form} columns={columns} experimentId="exp-1" tableName="readings" />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.queryByText(/^\(\d+\)$/)).not.toBeInTheDocument();
  });

  it("collapses the filters back to undefined when the last filter is removed", async () => {
    mountDistinct();
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <FiltersShelf form={form} columns={columns} experimentId="exp-1" tableName="readings" />
      ),
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "temp", role: "y" }],
              filters: [{ column: "site", operator: "equals", value: "alpha" }],
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.filters/ }));
    await user.click(await screen.findByRole("button", { name: "dataFilters.removeFilterOn" }));

    expect(form.getValues("dataConfig.filters")).toBeUndefined();
  });

  it("keeps the remaining filters in form state when one of several is removed", async () => {
    mountDistinct();
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <FiltersShelf form={form} columns={columns} experimentId="exp-1" tableName="readings" />
      ),
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "temp", role: "y" }],
              filters: [
                { column: "site", operator: "equals", value: "alpha" },
                { column: "value", operator: "greater_than", value: 5 },
              ],
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.filters/ }));
    const removeButtons = await screen.findAllByRole("button", {
      name: "dataFilters.removeFilterOn",
    });
    await user.click(removeButtons[0]);

    const remaining = form.getValues("dataConfig.filters") ?? [];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].column).toBe("value");
  });
});
