import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { LineDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "t", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "label", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <LineDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("LineDataPanel", () => {
  it("renders X, Y, group-by, and facet shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.xAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.yAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.groupBy" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.facetDimension" }),
    ).toBeInTheDocument();
  });

  it("seeds the X-axis trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "readings",
          dataSources: [
            { tableName: "readings", columnName: "t", role: "x" },
            { tableName: "readings", columnName: "y", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("t");
  });

  it("writes the picked X column into the data sources", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "readings",
          dataSources: [
            { tableName: "readings", columnName: "", role: "x" },
            { tableName: "readings", columnName: "y", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("t"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "t", tableName: "readings" }));
  });

  it("exposes the Add series button on the Y shelf", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "workspace.shelves.addSeries" })).toBeInTheDocument();
  });

  it("filters group-by columns to categorical only", async () => {
    const user = userEvent.setup();
    renderPanel();
    const before = screen.getAllByRole("combobox").length;
    await user.click(screen.getByRole("button", { name: /workspace.shelves.groupBy/i }));
    const combos = await screen.findAllByRole("combobox");
    await user.click(combos[before]);
    expect(await screen.findByText("label")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^y$/i })).not.toBeInTheDocument();
  });
});
