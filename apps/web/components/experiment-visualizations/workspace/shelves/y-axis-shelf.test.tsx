import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import type { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import type { ChartFormValues } from "../../charts/form-values";
import { lineChartType } from "../../charts/line";
import { YAxisShelf } from "./y-axis-shelf";

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
  { name: "humidity", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "label", type_name: "STRING", type_text: "STRING" },
];

describe("YAxisShelf", () => {
  it("renders one series block per Y data source", () => {
    renderWithForm<ChartFormValues>((form) => <YAxisShelf form={form} columns={columns} />, {
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
    renderWithForm<ChartFormValues>((form) => <YAxisShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(
      screen.queryByRole("button", { name: "workspace.shelves.removeSeries" }),
    ).not.toBeInTheDocument();
  });

  it("appends a new Y data source and seeds a default color when add-series is clicked", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <YAxisShelf form={form} columns={columns} />;
      },
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.addSeries/ }));

    const after = formRef.getValues("dataConfig.dataSources");
    expect(after.filter((d) => d.role === "y")).toHaveLength(2);

    const colors = formRef.getValues("config.color");
    expect(Array.isArray(colors)).toBe(true);
    expect((colors as string[]).length).toBeGreaterThanOrEqual(2);
  });

  it("removes a Y series when the trash button is clicked (and only when >1 series)", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <YAxisShelf form={form} columns={columns} />;
      },
      {
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
      },
    );

    const removeButtons = screen.getAllByRole("button", {
      name: "workspace.shelves.removeSeries",
    });
    expect(removeButtons).toHaveLength(2);

    await user.click(removeButtons[0]);

    const after = formRef.getValues("dataConfig.dataSources");
    expect(after.filter((d) => d.role === "y")).toHaveLength(1);
  });

  it("auto-picks `category` for the Y axis when the FIRST series picks a string column", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <YAxisShelf form={form} columns={columns} />;
      },
      {
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
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("label"));

    expect(formRef.getValues("config.yAxisType")).toBe("category");
    expect(formRef.getValues("config.yAxisTitle")).toBe("label");
  });

  it("does NOT change yAxisType when a NON-FIRST series picks a column (the axis belongs to series 0)", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <YAxisShelf form={form} columns={columns} />;
      },
      {
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
      },
    );

    const selects = screen.getAllByRole("combobox", { name: "workspace.shelves.column" });
    // Open the SECOND series's column picker.
    await user.click(selects[1]);
    await user.click(await screen.findByText("label"));

    // First series defines the axis; touching the second must leave it
    // alone even when the new column is a string.
    expect(formRef.getValues("config.yAxisType")).toBe("linear");
  });

  it("updates the alias whenever the column changes (even when the alias was non-empty)", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <YAxisShelf form={form} columns={columns} />;
      },
      {
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
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("humidity"));

    // Before the fix, the alias survived the column change as a stale label.
    expect(formRef.getValues("dataConfig.dataSources.1.alias")).toBe("humidity");
  });

  it("disables the per-series color inputs when a Color dimension column is selected", () => {
    const { container } = renderWithForm<ChartFormValues>(
      (form) => <YAxisShelf form={form} columns={columns} />,
      {
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
      },
    );

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
    renderWithForm<ChartFormValues>(
      (form) => <YAxisShelf form={form} columns={columns} showSeriesColor={false} />,
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.queryByText("workspace.shelves.color")).not.toBeInTheDocument();
  });
});
