import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { windRoseChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { WindRoseDataPanel } from "../panels/data-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: windRoseChartType.family,
    chartType: windRoseChartType.type,
    config: windRoseChartType.defaultConfig(),
    dataConfig: windRoseChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "direction", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "speed", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <WindRoseDataPanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("WindRoseDataPanel", () => {
  it("renders direction and magnitude shelves", () => {
    renderPanel();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.windRoseDirection" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.windRoseMagnitude" }),
    ).toBeInTheDocument();
  });

  it("seeds the direction trigger from the existing x data source", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "wind",
          dataSources: [
            { tableName: "wind", columnName: "direction", role: "x" },
            { tableName: "wind", columnName: "speed", role: "y" },
          ],
        },
      }),
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("direction");
  });

  it("writes the picked direction column into the x data source", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "wind",
          dataSources: [
            { tableName: "wind", columnName: "", role: "x" },
            { tableName: "wind", columnName: "speed", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("direction"));

    const xSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "x");
    expect(xSource).toEqual(
      expect.objectContaining({ columnName: "direction", tableName: "wind" }),
    );
  });

  it("writes the picked magnitude column into the y data source", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(
      defaults({
        dataConfig: {
          tableName: "wind",
          dataSources: [
            { tableName: "wind", columnName: "direction", role: "x" },
            { tableName: "wind", columnName: "", role: "y" },
          ],
        },
      }),
    );

    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByText("speed"));

    const ySource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "y");
    expect(ySource).toEqual(expect.objectContaining({ columnName: "speed", tableName: "wind" }));
  });
});
