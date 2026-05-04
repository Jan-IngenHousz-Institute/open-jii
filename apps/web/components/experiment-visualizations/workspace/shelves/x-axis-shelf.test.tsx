import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import type { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import type { ChartFormValues } from "../../charts/form-values";
import { lineChartType } from "../../charts/line";
import { XAxisShelf } from "./x-axis-shelf";

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

describe("XAxisShelf", () => {
  it("renders the section heading and the column / title / type controls", () => {
    renderWithForm<ChartFormValues>((form) => <XAxisShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(screen.getByText("workspace.shelves.xAxis")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.column")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.axisTitle")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.axisType")).toBeInTheDocument();
  });

  it("auto-picks `date` for the X axis when the user selects a temporal column", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <XAxisShelf form={form} columns={columns} />;
      },
      // Start with no X column picked so the column trigger renders the
      // placeholder; tests then drive the picker themselves.
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "", columnName: "", role: "x" }],
            },
            config: { ...lineChartType.defaultConfig(), xAxisType: "linear" },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("time"));

    expect(formRef.getValues("config.xAxisType")).toBe("date");
    expect(formRef.getValues("config.xAxisTitle")).toBe("time");
  });

  it("auto-picks `category` when the user selects a string column", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <XAxisShelf form={form} columns={columns} />;
      },
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "", columnName: "", role: "x" }],
            },
            config: { ...lineChartType.defaultConfig(), xAxisType: "linear" },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("sensor"));

    expect(formRef.getValues("config.xAxisType")).toBe("category");
  });

  it("keeps `linear` when the user selects a numeric column", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <XAxisShelf form={form} columns={columns} />;
      },
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "", columnName: "", role: "x" }],
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("temp"));

    expect(formRef.getValues("config.xAxisType")).toBe("linear");
  });

  it("propagates the picked column's tableName onto the data source entry", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <XAxisShelf form={form} columns={columns} />;
      },
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "", columnName: "", role: "x" }],
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("temp"));

    expect(formRef.getValues("dataConfig.dataSources.0.tableName")).toBe("readings");
    expect(formRef.getValues("dataConfig.dataSources.0.columnName")).toBe("temp");
  });

  it("renders columns with their type-name badge in the dropdown", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <XAxisShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    // Each badge value also appears inside the closed trigger (showing the
    // current selection), so use getAllByText to assert the dropdown also
    // lists each of them.
    expect((await screen.findAllByText("STRING")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("DOUBLE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TIMESTAMP").length).toBeGreaterThan(1);
  });

  it("falls back to xIndex=0 when no X data source exists yet", () => {
    renderWithForm<ChartFormValues>((form) => <XAxisShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [{ tableName: "readings", columnName: "temp", role: "y" }],
          },
        }),
      },
    });

    // First (and only) data source is the Y entry; xIndex defaults to 0
    // means the X form field reads from index 0 — which is "temp" in this
    // case, since the shelf doesn't synthesise a missing entry.
    expect(screen.getByRole("combobox", { name: "workspace.shelves.column" })).toHaveTextContent(
      "temp",
    );
  });
});
