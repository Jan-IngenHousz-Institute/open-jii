import { renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { correlationMatrixChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { CorrelationMatrixDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: correlationMatrixChartType.family,
    chartType: correlationMatrixChartType.type,
    config: correlationMatrixChartType.defaultConfig(),
    dataConfig: correlationMatrixChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "a", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "b", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "c", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <CorrelationMatrixDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("CorrelationMatrixDataPanel", () => {
  it("renders the correlation-columns heading", () => {
    renderPanel();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.correlationColumns" }),
    ).toBeInTheDocument();
  });

  it("clears aggregation when fewer than two columns are picked", async () => {
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [{ tableName: "data", columnName: "a", role: "y" }],
        },
      }),
    );
    await waitFor(() => {
      expect(form.getValues("dataConfig.aggregation")).toBeUndefined();
    });
  });

  it("builds bivariate corr functions for every unique pair", async () => {
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "a", role: "y" },
            { tableName: "data", columnName: "b", role: "y" },
            { tableName: "data", columnName: "c", role: "y" },
          ],
        },
      }),
    );
    await waitFor(() => {
      const fns = form.getValues("dataConfig.aggregation")?.functions;
      expect(fns).toHaveLength(3);
    });
    const fns = form.getValues("dataConfig.aggregation")?.functions;
    expect(fns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: "a", function: "corr", secondColumn: "b" }),
        expect.objectContaining({ column: "a", function: "corr", secondColumn: "c" }),
        expect.objectContaining({ column: "b", function: "corr", secondColumn: "c" }),
      ]),
    );
  });

  it("dedupes repeated columns when building pairs", async () => {
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "a", role: "y" },
            { tableName: "data", columnName: "a", role: "y" },
            { tableName: "data", columnName: "b", role: "y" },
          ],
        },
      }),
    );
    await waitFor(() => {
      const fns = form.getValues("dataConfig.aggregation")?.functions;
      expect(fns).toHaveLength(1);
    });
  });

  it("rebuilds pairs after adding a new column", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "data",
          dataSources: [
            { tableName: "data", columnName: "a", role: "y" },
            { tableName: "data", columnName: "b", role: "y" },
          ],
        },
      }),
    );

    await waitFor(() => {
      expect(form.getValues("dataConfig.aggregation")?.functions).toHaveLength(1);
    });

    await user.click(screen.getByRole("button", { name: "workspace.shelves.addSeries" }));
    const combos = screen.getAllByRole("combobox");
    await user.click(combos[combos.length - 1]);
    await user.click(await screen.findByText("c"));

    await waitFor(() => {
      expect(form.getValues("dataConfig.aggregation")?.functions).toHaveLength(3);
    });
  });
});
