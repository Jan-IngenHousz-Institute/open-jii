import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { bubbleChartType } from "../";
import { DataSourcesFieldArrayProvider } from "../../../../workspace/context/data-sources-field-array-context";
import type { ChartFormValues } from "../../../chart-config";
import { BubbleDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: bubbleChartType.family,
    chartType: bubbleChartType.type,
    config: bubbleChartType.defaultConfig(),
    dataConfig: bubbleChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "x", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "size", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "grp", type_name: "STRING", type_text: "STRING" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>
        <BubbleDataPanel form={form} columns={columns} />
      </DataSourcesFieldArrayProvider>
    ),
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("BubbleDataPanel", () => {
  it("renders X, Y, size, color-dimension, and facet shelves", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "workspace.shelves.xAxis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "workspace.shelves.yAxis" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.sizeDimension" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.groupBy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.facetDimension" }),
    ).toBeInTheDocument();
  });

  it("seeds the X-axis trigger from the existing data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "pts",
          dataSources: [
            { tableName: "pts", columnName: "x", role: "x" },
            { tableName: "pts", columnName: "y", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("x");
  });

  it("writes the picked X column into the data sources", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "pts",
          dataSources: [
            { tableName: "pts", columnName: "", role: "x" },
            { tableName: "pts", columnName: "y", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("x"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(expect.objectContaining({ columnName: "x", tableName: "pts" }));
  });

  it("opens the size shelf and exposes its aggregate dropdown", async () => {
    const user = userEvent.setup();
    renderPanel();
    const before = screen.queryAllByText("workspace.shelves.aggregate").length;
    await user.click(screen.getByRole("button", { name: /workspace.shelves.sizeDimension/i }));
    expect(screen.getAllByText("workspace.shelves.aggregate").length).toBeGreaterThan(before);
  });

  it("opens the color shelf and exposes its column picker", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /workspace.shelves.groupBy/i }));
    const labels = await screen.findAllByText("workspace.shelves.column");
    expect(labels.length).toBeGreaterThan(0);
  });
});
