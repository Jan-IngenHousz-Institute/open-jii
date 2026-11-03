import { renderWithForm, screen, userEvent, within, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { barChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { BarDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: barChartType.family,
    chartType: barChartType.type,
    config: barChartType.defaultConfig(),
    dataConfig: barChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "country", type_name: "STRING", type_text: "STRING" },
  { name: "sales", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "region", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <BarDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("BarDataPanel", () => {
  it.each(["Count", "Distinct count"])(
    "lets a researcher pick %s before a text Y column and clears it for a numeric aggregate",
    async (label) => {
      const user = userEvent.setup();
      const { form } = renderPanel(
        defaults({
          dataConfig: {
            tableName: "sales",
            dataSources: [
              { tableName: "sales", columnName: "country", role: "x" },
              { tableName: "sales", columnName: "", role: "y" },
              { tableName: "sales", columnName: "sales", role: "y", aggregate: "sum" },
            ],
          },
        }),
      );
      const shelf = screen
        .getByRole("heading", { name: "workspace.shelves.yAxis" })
        .closest("section");
      if (!shelf) throw new Error("Y shelf is missing");
      const aggregates = within(shelf).getAllByRole("combobox", {
        name: "workspace.shelves.aggregate",
      });
      await user.click(aggregates[0]);
      await user.click(await screen.findByRole("option", { name: label }));
      const columnPickers = within(shelf).getAllByRole("combobox", {
        name: "workspace.shelves.column",
      });
      await user.click(columnPickers[0]);
      await user.click(await screen.findByRole("option", { name: /region/ }));
      expect(form.getValues("dataConfig.dataSources.1.columnName")).toBe("region");
      expect(form.getValues("dataConfig.dataSources.1.aggregate")).toBe(
        label === "Count" ? "count" : "count_distinct",
      );
      expect(form.getValues("config.yAxisType")).toBe("linear");
      expect(form.getValues("dataConfig.aggregation")?.functions).toContainEqual({
        column: "region",
        function: label === "Count" ? "count" : "count_distinct",
        alias: label === "Count" ? "region_count_s1" : "region_count_distinct_s1",
      });
      await user.click(columnPickers[1]);
      await screen.findByRole("option", { name: /sales/ });
      expect(screen.queryByRole("option", { name: /region/ })).not.toBeInTheDocument();
      await user.keyboard("{Escape}");
      await user.click(aggregates[0]);
      await user.click(await screen.findByRole("option", { name: "Sum" }));
      await waitFor(() => expect(form.getValues("dataConfig.dataSources.1.columnName")).toBe(""));
      expect(form.getValues("dataConfig.aggregation")?.functions).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ column: "region" })]),
      );
      await user.click(columnPickers[0]);
      await screen.findByRole("option", { name: /sales/ });
      expect(screen.queryByRole("option", { name: /region/ })).not.toBeInTheDocument();
    },
  );

  it("renders X, Y, group-by, and facet shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.xAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.yAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.groupBy" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.facetDimension" }),
    ).toBeInTheDocument();
  });

  it("hides the X-axis type picker (bar forces categorical) and keeps Y's", () => {
    renderPanel();
    // Only one axis-type select remains: Y axis.
    expect(screen.getAllByText("workspace.shelves.axisType")).toHaveLength(1);
  });

  it("seeds the X-axis trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "sales",
          dataSources: [
            { tableName: "sales", columnName: "country", role: "x" },
            { tableName: "sales", columnName: "sales", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("country");
  });

  it("writes the picked X column into the data sources", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "sales",
          dataSources: [
            { tableName: "sales", columnName: "", role: "x" },
            { tableName: "sales", columnName: "sales", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("country"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "country", tableName: "sales" }));
  });

  it("exposes the Add series button on the Y shelf", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "workspace.shelves.addSeries" })).toBeInTheDocument();
  });
});
