import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import type { ReactElement } from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { DataSourcesFieldArrayProvider } from "../context/data-sources-field-array-context";
import { YAxisShelf } from "./y-axis-shelf";

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

const columns: ExperimentDataColumn[] = [
  { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "humidity", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "label", type_name: "STRING", type_text: "STRING" },
];

describe("YAxisShelf", () => {
  it("renders one series block per Y data source", () => {
    renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "readings", columnName: "humidity", role: "y" },
            ],
          },
        }),
      },
    });

    // Each Y series renders its own "Series N" header — assert the count
    // rather than singular existence.
    expect(screen.getAllByText("workspace.shelves.series")).toHaveLength(2);
    // Two Y series → two column selects.
    expect(screen.getAllByRole("combobox", { name: "workspace.shelves.column" })).toHaveLength(2);
  });

  it("hides the per-series remove button when there is only one Y series", () => {
    renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(
      screen.queryByRole("button", { name: "workspace.shelves.removeSeries" }),
    ).not.toBeInTheDocument();
  });

  it("appends a new Y data source and seeds a default color when add-series is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.addSeries/ }));

    const after = form.getValues("dataConfig.dataSources");
    expect(after.filter((d) => d.role === "y")).toHaveLength(2);

    const colors = form.getValues("config.color");
    expect(Array.isArray(colors)).toBe(true);
    expect((colors as string[]).length).toBeGreaterThanOrEqual(2);
  });

  it("removes a Y series when the trash button is clicked (and only when >1 series)", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "readings", columnName: "humidity", role: "y" },
            ],
          },
        }),
      },
    });

    const removeButtons = screen.getAllByRole("button", {
      name: "workspace.shelves.removeSeries",
    });
    expect(removeButtons).toHaveLength(2);

    await user.click(removeButtons[0]);

    const after = form.getValues("dataConfig.dataSources");
    expect(after.filter((d) => d.role === "y")).toHaveLength(1);
  });

  it("auto-picks `category` for the Y axis when the FIRST series picks a string column", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "", columnName: "", role: "y" },
            ],
          },
        }),
      },
    });

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("label"));

    expect(form.getValues("config.yAxisType")).toBe("category");
    expect(form.getValues("config.yAxisTitle")).toBe("label");
  });

  it("does NOT change yAxisType when a NON-FIRST series picks a column (the axis belongs to series 0)", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "", columnName: "", role: "y" },
            ],
          },
          config: { ...lineChartType.defaultConfig(), yAxisType: "linear" },
        }),
      },
    });

    const selects = screen.getAllByRole("combobox", { name: "workspace.shelves.column" });
    // Open the SECOND series's column picker.
    await user.click(selects[1]);
    await user.click(await screen.findByText("label"));

    // First series defines the axis; touching the second must leave it
    // alone even when the new column is a string.
    expect(form.getValues("config.yAxisType")).toBe("linear");
  });

  it("updates the alias whenever the column changes (even when the alias was non-empty)", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              {
                tableName: "readings",
                columnName: "temp",
                role: "y",
                alias: "Temperature",
              },
            ],
          },
        }),
      },
    });

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("humidity"));

    // Before the fix, the alias survived the column change as a stale label.
    expect(form.getValues("dataConfig.dataSources.1.alias")).toBe("humidity");
  });

  it("disables the per-series color inputs when a Color dimension column is selected", () => {
    const { container } = renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "readings", columnName: "label", role: "color" },
            ],
          },
        }),
      },
    });

    // Color picker uses `<input type="color">` (no role) plus a hex
    // `<input type="text">`; both should be disabled when a Color column
    // is mapped. Query both via the type attribute.
    const colorPickers = container.querySelectorAll('input[type="color"]');
    expect(colorPickers.length).toBeGreaterThan(0);
    for (const el of colorPickers) {
      expect(el).toBeDisabled();
    }
  });

  it("hides per-series color inputs when showSeriesColor is false", () => {
    renderShelf((form) => <YAxisShelf form={form} columns={columns} showSeriesColor={false} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(screen.queryByText("workspace.shelves.color")).not.toBeInTheDocument();
  });

  it("hides the add-series button once maxSeries is reached", () => {
    renderShelf((form) => <YAxisShelf form={form} columns={columns} maxSeries={1} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(
      screen.queryByRole("button", { name: /workspace\.shelves\.addSeries/ }),
    ).not.toBeInTheDocument();
  });

  it("renders the secondary axis fields when a Y series targets the secondary axis", () => {
    renderShelf((form) => <YAxisShelf form={form} columns={columns} showCartesianControls />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              {
                tableName: "readings",
                columnName: "humidity",
                role: "y",
                axis: "secondary",
              },
            ],
          },
        }),
      },
    });

    expect(screen.getByText("workspace.shelves.secondaryAxisTitle")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.secondaryAxisType")).toBeInTheDocument();
  });

  it("writes the secondary axis title and type when the user edits them", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      (form) => <YAxisShelf form={form} columns={columns} showCartesianControls />,
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [
                { tableName: "readings", columnName: "time", role: "x" },
                { tableName: "readings", columnName: "temp", role: "y" },
                {
                  tableName: "readings",
                  columnName: "humidity",
                  role: "y",
                  axis: "secondary",
                },
              ],
            },
          }),
        },
      },
    );

    await user.type(
      screen.getByPlaceholderText("workspace.shelves.secondaryAxisTitlePlaceholder"),
      "Humidity",
    );
    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.secondaryAxisType" }));
    await user.click(await screen.findByText("workspace.axisTypes.log"));

    expect(form.getValues("config.y2AxisTitle")).toBe("Humidity");
    expect(form.getValues("config.y2AxisType")).toBe("log");
  });

  it("omits the secondary axis fields when no Y series targets it (even with cartesian controls on)", () => {
    renderShelf((form) => <YAxisShelf form={form} columns={columns} showCartesianControls />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(screen.queryByText("workspace.shelves.secondaryAxisTitle")).not.toBeInTheDocument();
  });

  it("hides the y-axis-type select when hideAxisType is true", () => {
    renderShelf((form) => <YAxisShelf form={form} columns={columns} hideAxisType />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(screen.queryByText("workspace.shelves.axisType")).not.toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.axisTitle")).toBeInTheDocument();
  });

  it("flags a Y series as silently-dropped when GROUP BY is active without its own aggregate", () => {
    renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y", aggregate: "avg" },
              { tableName: "readings", columnName: "humidity", role: "y" },
            ],
            aggregation: {
              groupBy: [{ column: "time", timeBucket: "day" }],
              functions: [{ column: "temp", function: "avg", alias: "temp_avg_s1" }],
            },
          },
        }),
      },
    });

    expect(screen.getByText("workspace.shelves.seriesSilentlyDropped")).toBeInTheDocument();
  });

  it("auto-aggregates a freshly-picked Y with AVG when X bucketing is already active", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "", columnName: "", role: "y" },
            ],
            aggregation: { groupBy: [{ column: "time", timeBucket: "day" }] },
          },
        }),
      },
    });

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("temp"));

    expect(form.getValues("dataConfig.dataSources.1.aggregate")).toBe("avg");
  });

  it("writes the picked aggregate through to the data source via handleAggregateChange", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.aggregate" }));
    await user.click(await screen.findByText("Sum"));

    expect(form.getValues("dataConfig.dataSources.1.aggregate")).toBe("sum");
  });

  it("clears traceType/axis from the new ordinal-0 Y before removing the previous first series", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      (form) => <YAxisShelf form={form} columns={columns} showCartesianControls />,
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [
                { tableName: "readings", columnName: "time", role: "x" },
                { tableName: "readings", columnName: "temp", role: "y" },
                {
                  tableName: "readings",
                  columnName: "humidity",
                  role: "y",
                  traceType: "bar",
                  axis: "secondary",
                },
              ],
            },
          }),
        },
      },
    );

    const removeButtons = screen.getAllByRole("button", {
      name: "workspace.shelves.removeSeries",
    });
    await user.click(removeButtons[0]);

    const remaining = form.getValues("dataConfig.dataSources").filter((d) => d.role === "y");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].columnName).toBe("humidity");
    expect(remaining[0].traceType).toBeUndefined();
    expect(remaining[0].axis).toBeUndefined();
  });

  it("seeds the next color from a non-array color value when add-series is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      // showSeriesColor=false so the inner `config.color.0` FormField doesn't
      // re-index a scalar color string into a single char.
      (form) => <YAxisShelf form={form} columns={columns} showSeriesColor={false} />,
      {
        useFormProps: {
          defaultValues: defaults({
            config: { ...lineChartType.defaultConfig(), color: "#abcdef" },
          }),
        },
      },
    );

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.addSeries/ }));
    const colors = form.getValues("config.color");
    expect(Array.isArray(colors)).toBe(true);
    expect(Array.isArray(colors) && colors[0]).toBe("#abcdef");
    expect(Array.isArray(colors) && colors.length).toBe(2);
  });

  it("does NOT flag the warning when the Y column is itself in groupBy (heatmap/contour case)", () => {
    renderShelf((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "label", role: "y" },
            ],
            aggregation: {
              groupBy: [{ column: "time", timeBucket: "day" }, { column: "label" }],
            },
          },
        }),
      },
    });

    expect(screen.queryByText("workspace.shelves.seriesSilentlyDropped")).not.toBeInTheDocument();
  });
});
