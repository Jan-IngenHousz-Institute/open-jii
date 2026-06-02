import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { areaChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { AreaDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: areaChartType.family,
    chartType: areaChartType.type,
    config: areaChartType.defaultConfig(),
    dataConfig: areaChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "load", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "lab", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <AreaDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("AreaDataPanel", () => {
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
            { tableName: "readings", columnName: "time", role: "x" },
            { tableName: "readings", columnName: "load", role: "y" },
          ],
        },
      }),
    );
    const triggers = screen.getAllByRole("combobox");
    expect(triggers[0]).toHaveTextContent("time");
  });

  it("writes the picked X column into the data sources", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "readings",
          dataSources: [
            { tableName: "readings", columnName: "", role: "x" },
            { tableName: "readings", columnName: "load", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("time"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "time", tableName: "readings" }));
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
    const groupCombo = combos[before];
    await user.click(groupCombo);
    expect(await screen.findByText("lab")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^load/i })).not.toBeInTheDocument();
  });
});
