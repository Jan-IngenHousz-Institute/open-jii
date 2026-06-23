import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
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

const columns: ExperimentDataColumn[] = [
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
    // Start with no X column picked so the column trigger renders the
    // placeholder; tests then drive the picker themselves.
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} />,
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

    expect(form.getValues("config.xAxisType")).toBe("date");
    expect(form.getValues("config.xAxisTitle")).toBe("time");
  });

  it("auto-picks `category` when the user selects a string column", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} />,
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

    expect(form.getValues("config.xAxisType")).toBe("category");
  });

  it("keeps `linear` when the user selects a numeric column", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} />,
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

    expect(form.getValues("config.xAxisType")).toBe("linear");
  });

  it("propagates the picked column's tableName onto the data source entry", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} />,
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

    expect(form.getValues("dataConfig.dataSources.0.tableName")).toBe("readings");
    expect(form.getValues("dataConfig.dataSources.0.columnName")).toBe("temp");
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

  it("renders the X-None option only when allowNone is true and selecting it clears the axis title and resets type", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} allowNone />,
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "time", role: "x" }],
            },
            config: { ...lineChartType.defaultConfig(), xAxisType: "date", xAxisTitle: "time" },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("workspace.shelves.xAxisNone"));

    expect(form.getValues("dataConfig.dataSources.0.columnName")).toBe("");
    expect(form.getValues("config.xAxisTitle")).toBe("");
    expect(form.getValues("config.xAxisType")).toBe("linear");
  });

  it("shows the X-None help text once the None option is the active value", () => {
    renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} allowNone />,
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "", role: "x" }],
            },
          }),
        },
      },
    );

    expect(screen.getByText("workspace.shelves.xAxisNoneHelp")).toBeInTheDocument();
  });

  it("hides the X-None option entirely when allowNone is false", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <XAxisShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    expect(screen.queryByText("workspace.shelves.xAxisNone")).not.toBeInTheDocument();
  });

  it("drops a stale time bucket when switching from a temporal to a non-temporal column", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} />,
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "time", role: "x" }],
              aggregation: { groupBy: [{ column: "time", timeBucket: "day" }] },
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("sensor"));

    const groupBy = form.getValues("dataConfig.aggregation")?.groupBy ?? [];
    expect(groupBy.find((g) => g.column === "time")).toBeUndefined();
  });

  it("renders the time-bucket select for temporal X columns and writes the bucket back", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} />,
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.shelves.timeBucket")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.timeBucket" }));
    await user.click(await screen.findByText("Hour"));

    const groupBy = form.getValues("dataConfig.aggregation")?.groupBy ?? [];
    expect(groupBy.find((g) => g.column === "time")?.timeBucket).toBe("hour");
  });

  it("defaults each non-aggregating Y series to AVG when a bucket activates without any aggregate set", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} />,
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

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.timeBucket" }));
    await user.click(await screen.findByText("Day"));

    const sources = form.getValues("dataConfig.dataSources");
    expect(sources[1].aggregate).toBe("avg");
    expect(sources[2].aggregate).toBe("avg");
  });

  it("clears the bucket when the user picks the no-bucket sentinel", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} />,
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "time", role: "x" }],
              aggregation: { groupBy: [{ column: "time", timeBucket: "day" }] },
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.timeBucket" }));
    await user.click(await screen.findByText("workspace.shelves.noBucket"));

    const groupBy = form.getValues("dataConfig.aggregation")?.groupBy ?? [];
    expect(groupBy.find((g) => g.column === "time")).toBeUndefined();
  });

  it("pairs the title beside the column picker when axis-type and time-bucket are both hidden", () => {
    renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} hideAxisType hideTimeBucket />,
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [{ tableName: "readings", columnName: "temp", role: "x" }],
            },
          }),
        },
      },
    );

    expect(screen.getByText("workspace.shelves.column")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.axisTitle")).toBeInTheDocument();
    expect(screen.queryByText("workspace.shelves.axisType")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.shelves.timeBucket")).not.toBeInTheDocument();
  });

  it("hides the axis-type select but keeps the title field on its own row when only hideAxisType is set", () => {
    renderWithForm<ChartFormValues>(
      (form) => <XAxisShelf form={form} columns={columns} hideAxisType />,
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.shelves.axisTitle")).toBeInTheDocument();
    expect(screen.queryByText("workspace.shelves.axisType")).not.toBeInTheDocument();
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
