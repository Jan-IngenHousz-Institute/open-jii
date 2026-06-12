import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { YSeriesItem } from "./y-series-item";

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
  { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "humidity", type_name: "DOUBLE", type_text: "DOUBLE" },
];

const baseProps = {
  dsIndex: 1,
  seriesIndex: 0,
  seriesColumn: "temp",
  canRemove: true,
  willBeSilentlyDropped: false,
  aggregateValue: "__none__",
  columns,
  effectiveErrorColumns: columns,
  xColumnName: "time",
  aggregateOptions: [
    { value: "avg", label: "Average" },
    { value: "sum", label: "Sum" },
  ],
  showCartesianControls: false,
  showErrorColumn: false,
  showSeriesColor: false,
  hideAggregate: false,
  isColorMapped: false,
  defaultTraceType: undefined,
};

describe("YSeriesItem", () => {
  it("renders the series header and column picker", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.shelves.series")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.column")).toBeInTheDocument();
  });

  it("renders the remove button when canRemove is true", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(
      screen.getByRole("button", { name: "workspace.shelves.removeSeries" }),
    ).toBeInTheDocument();
  });

  it("hides the remove button when canRemove is false", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          canRemove={false}
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(
      screen.queryByRole("button", { name: "workspace.shelves.removeSeries" }),
    ).not.toBeInTheDocument();
  });

  it("calls onRemove with the dsIndex when the remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={onRemove}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("button", { name: "workspace.shelves.removeSeries" }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("warns when the series will be silently dropped by the renderer", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          willBeSilentlyDropped
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.shelves.seriesSilentlyDropped")).toBeInTheDocument();
  });

  it("omits the aggregate select when hideAggregate is true", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          hideAggregate
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.queryByText("workspace.shelves.aggregate")).not.toBeInTheDocument();
  });

  it("renders the error-column select when showErrorColumn is set", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          showErrorColumn
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.shelves.errorColumn")).toBeInTheDocument();
  });

  it("shows the per-series color picker when showSeriesColor and not color-mapped", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          seriesIndex={1}
          showSeriesColor
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.shelves.color")).toBeInTheDocument();
  });

  it("renders traceType + axis selects only when showCartesianControls and seriesIndex > 0", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          seriesIndex={1}
          showCartesianControls
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.shelves.renderAs")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.axisAssignment")).toBeInTheDocument();
  });

  it("omits the traceType + axis selects on the first series (anchors chart identity)", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          seriesIndex={0}
          showCartesianControls
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.queryByText("workspace.shelves.renderAs")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.shelves.axisAssignment")).not.toBeInTheDocument();
  });

  it("labels the default render-as choice from the explicit defaultTraceType", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          seriesIndex={1}
          showCartesianControls
          defaultTraceType="bar"
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.shelves.renderAsDefault")).toBeInTheDocument();
  });

  it("writes a concrete traceType when the user picks a non-default option", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          dsIndex={2}
          seriesIndex={1}
          showCartesianControls
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
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

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.renderAs" }));
    await user.click(await screen.findByText("workspace.shelves.traceType.bar"));

    expect(form.getValues("dataConfig.dataSources.2.traceType")).toBe("bar");
  });

  it("clears traceType back to undefined when the default option is re-selected", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          dsIndex={2}
          seriesIndex={1}
          showCartesianControls
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
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
                  traceType: "scatter",
                },
              ],
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.renderAs" }));
    await user.click(await screen.findByText("workspace.shelves.renderAsDefault"));

    expect(form.getValues("dataConfig.dataSources.2.traceType")).toBeUndefined();
  });

  it("writes axis=secondary when the user picks the secondary axis option", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          dsIndex={2}
          seriesIndex={1}
          showCartesianControls
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
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

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.axisAssignment" }));
    await user.click(await screen.findByText("workspace.shelves.axis.secondary"));

    expect(form.getValues("dataConfig.dataSources.2.axis")).toBe("secondary");
  });

  it("clears axis back to undefined when the primary option is re-selected", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          dsIndex={2}
          seriesIndex={1}
          showCartesianControls
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      {
        useFormProps: {
          defaultValues: defaults({
            dataConfig: {
              tableName: "readings",
              dataSources: [
                { tableName: "readings", columnName: "time", role: "x" },
                { tableName: "readings", columnName: "temp", role: "y" },
                { tableName: "readings", columnName: "humidity", role: "y", axis: "secondary" },
              ],
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.axisAssignment" }));
    await user.click(await screen.findByText("workspace.shelves.axis.primary"));

    expect(form.getValues("dataConfig.dataSources.2.axis")).toBeUndefined();
  });

  it("writes the picked error column back onto the data source", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          showErrorColumn
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.errorColumn" }));
    await user.click(await screen.findByText("humidity"));

    expect(form.getValues("dataConfig.dataSources.1.errorColumn")).toBe("humidity");
  });

  it("calls onColumnChange with the new column and seriesIndex when the column changes", async () => {
    const user = userEvent.setup();
    const onColumnChange = vi.fn();
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          onColumnChange={onColumnChange}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.column" }));
    await user.click(await screen.findByText("humidity"));

    expect(onColumnChange).toHaveBeenCalledWith("humidity", 0);
  });

  it("disables and re-labels aggregates that require an X column when xColumnName is empty", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          xColumnName=""
          aggregateOptions={[
            { value: "avg", label: "Average" },
            { value: "cumsum", label: "Cumulative sum", requiresXColumn: true },
          ]}
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.aggregate" }));
    expect(
      await screen.findByText("workspace.shelves.aggregateNeedsXColumnLabel"),
    ).toBeInTheDocument();
  });

  it("calls onAggregateChange with the picked function and dsIndex", async () => {
    const user = userEvent.setup();
    const onAggregateChange = vi.fn();
    renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          onColumnChange={vi.fn()}
          onAggregateChange={onAggregateChange}
          onRemove={vi.fn()}
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.aggregate" }));
    await user.click(await screen.findByText("Sum"));

    expect(onAggregateChange).toHaveBeenCalledWith("sum", 1);
  });

  it("clears the error column back to undefined when 'none' is re-picked", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => (
        <YSeriesItem
          {...baseProps}
          form={form}
          showErrorColumn
          onColumnChange={vi.fn()}
          onAggregateChange={vi.fn()}
          onRemove={vi.fn()}
        />
      ),
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
                  errorColumn: "humidity",
                },
              ],
            },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.shelves.errorColumn" }));
    await user.click(await screen.findByText("workspace.shelves.errorColumnNone"));

    expect(form.getValues("dataConfig.dataSources.1.errorColumn")).toBeUndefined();
  });
});
