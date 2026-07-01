import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { SingleColumnShelf } from "./single-column-shelf";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: {
      tableName: "readings",
      dataSources: [{ tableName: "readings", columnName: "label", role: "labels" }],
    },
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "label", type_name: "STRING", type_text: "STRING" },
  { name: "count", type_name: "INT", type_text: "INT" },
];

describe("SingleColumnShelf", () => {
  it("renders the heading, column label, and select trigger", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <SingleColumnShelf
          form={form}
          columns={columns}
          role="labels"
          heading="Labels"
          columnLabel="workspace.shelves.column"
          placeholder="Pick a label column"
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByRole("heading", { name: "Labels" })).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.column")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("seeds the trigger with the existing column for the role", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <SingleColumnShelf
          form={form}
          columns={columns}
          role="labels"
          heading="Labels"
          columnLabel="workspace.shelves.column"
          placeholder="Pick a label column"
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("label");
  });

  it("writes the picked column back into the role's data source", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <SingleColumnShelf
          form={form}
          columns={columns}
          role="labels"
          heading="Labels"
          columnLabel="workspace.shelves.column"
          placeholder="Pick a label column"
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("count"));

    expect(form.getValues("dataConfig.dataSources.0.columnName")).toBe("count");
  });

  it("propagates the current table name onto the data source row", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <SingleColumnShelf
          form={form}
          columns={columns}
          role="labels"
          heading="Labels"
          columnLabel="workspace.shelves.column"
          placeholder="Pick a label column"
        />
      ),
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "experiment_metrics",
              dataSources: [{ tableName: "old_table", columnName: "label", role: "labels" }],
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("count"));

    expect(form.getValues("dataConfig.dataSources.0.tableName")).toBe("experiment_metrics");
  });

  it("shows the type-name badges on the dropdown items", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>(
      (form) => (
        <SingleColumnShelf
          form={form}
          columns={columns}
          role="labels"
          heading="Labels"
          columnLabel="workspace.shelves.column"
          placeholder="Pick a label column"
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("combobox"));
    expect((await screen.findAllByText("STRING")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("INT").length).toBeGreaterThan(0);
  });
});
