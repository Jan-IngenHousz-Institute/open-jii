import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import type { ReactElement } from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../../../charts/basic/line";
import type { ChartFormValues } from "../../../charts/chart-config";
import { DataSourcesFieldArrayProvider } from "../../context/data-sources-field-array-context";
import { ColorDimensionShelf } from "./color-dimension-shelf";

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
      dataSources: [
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "temp", role: "y" },
      ],
    },
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "sensor", type_name: "STRING", type_text: "STRING" },
];

async function expandShelf(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /workspace\.shelves\.groupBy/ }));
}

describe("ColorDimensionShelf", () => {
  it("renders only the column picker until a color column is chosen", async () => {
    const user = userEvent.setup();
    renderShelf((form) => <ColorDimensionShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(screen.getByText("workspace.shelves.groupBy")).toBeInTheDocument();
    await expandShelf(user);
    // Mode select + colorscale only render once a column is picked.
    expect(screen.queryByText("workspace.shelves.colorMode")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.shelves.colorScale")).not.toBeInTheDocument();
  });

  it("appends a color data source when the user picks a column", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <ColorDimensionShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await expandShelf(user);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("temp"));

    const sources = form.getValues("dataConfig.dataSources");
    expect(sources.find((d) => d.role === "color")?.columnName).toBe("temp");
  });

  it("auto-picks `categorical` mode when the chosen column is a string", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <ColorDimensionShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await expandShelf(user);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("sensor"));

    expect(form.getValues("config.colorMode")).toBe("categorical");
  });

  it("auto-picks `continuous` mode when the chosen column is numeric", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <ColorDimensionShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await expandShelf(user);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("temp"));

    expect(form.getValues("config.colorMode")).toBe("continuous");
  });

  it("seeds the colorbar title from the column name when the title is empty", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <ColorDimensionShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await expandShelf(user);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("temp"));

    expect(form.getValues("config.marker.colorbar.title.text")).toBe("temp");
  });

  it("removes the color data source and clears the colorbar title when the user picks 'none'", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <ColorDimensionShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "readings", columnName: "temp", role: "color" },
            ],
          },
          config: {
            ...lineChartType.defaultConfig(),
            marker: { colorbar: { title: { text: "temp" } } },
          },
        }),
      },
    });

    await expandShelf(user);
    // With a color column pre-selected the continuous-mode panel renders
    // its own colorScale combobox underneath. The column picker is the
    // first combobox in DOM order.
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByText("workspace.shelves.groupByNone"));

    const sources = form.getValues("dataConfig.dataSources");
    expect(sources.find((d) => d.role === "color")).toBeUndefined();
    expect(form.getValues("config.marker.colorbar.title.text")).toBe("");
  });

  it("renders the categorical preview swatches when the mode is categorical", async () => {
    const user = userEvent.setup();
    renderShelf((form) => <ColorDimensionShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "readings", columnName: "sensor", role: "color" },
            ],
          },
          config: {
            ...lineChartType.defaultConfig(),
            colorMode: "categorical",
          },
        }),
      },
    });

    await expandShelf(user);
    expect(screen.getByText("workspace.shelves.colorModeCategoricalHelp")).toBeInTheDocument();
    // Continuous-only controls should be hidden.
    expect(screen.queryByText("workspace.shelves.colorScale")).not.toBeInTheDocument();
  });

  it("renders the colorscale picker and gradient preview in continuous mode", async () => {
    const user = userEvent.setup();
    renderShelf((form) => <ColorDimensionShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "readings", columnName: "temp", role: "color" },
            ],
          },
          config: {
            ...lineChartType.defaultConfig(),
            colorMode: "continuous",
          },
        }),
      },
    });

    await expandShelf(user);
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
  });
});
