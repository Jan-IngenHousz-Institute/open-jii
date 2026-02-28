import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { renderWithForm, screen, userEvent, within } from "@/test/test-utils";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ExperimentTableMetadata, DataColumn } from "@repo/api";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { DataSourceStep } from "./data-source-step";

// Select — pragmatic mock (Radix Select portal/pointer issues in jsdom)
vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    Select: ({ value, children }: { value?: string; children: React.ReactNode }) => (
      <div data-value={value}>{React.Children.toArray(children)}</div>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => (
      <button type="button" role="combobox">
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <div role="option" aria-label={value}>
        {children}
      </div>
    ),
  };
});

vi.mock("../chart-configurators/data", () => ({
  LineChartDataConfigurator: ({ columns }: { columns: DataColumn[] }) => (
    <div data-testid="line-chart-configurator">Columns: {columns.length}</div>
  ),
  ScatterChartDataConfigurator: ({ columns }: { columns: DataColumn[] }) => (
    <div data-testid="scatter-chart-configurator">Columns: {columns.length}</div>
  ),
}));

vi.mock("../chart-preview/chart-preview-modal", () => ({
  ChartPreviewModal: ({
    experimentId,
    isOpen,
    onOpenChange,
  }: {
    experimentId: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="chart-preview-modal">
      <span>Experiment ID: {experimentId}</span>
      <span>Open: {String(isOpen)}</span>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close Preview
      </button>
    </div>
  ),
}));

// useExperimentData — pragmatic mock (hook does heavy tanstack-table column creation + formatting)
vi.mock("@/hooks/experiment/useExperimentData/useExperimentData", () => ({
  useExperimentData: vi.fn(),
}));

const mockTables: ExperimentTableMetadata[] = [
  { name: "measurements", displayName: "Measurements", totalRows: 100 },
  { name: "sensors", displayName: "Sensors", totalRows: 50 },
];

const columnsByTable: Record<string, { rawColumns: DataColumn[] }> = {
  measurements: {
    rawColumns: [
      { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
      { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" },
      { name: "humidity", type_name: "DOUBLE", type_text: "DOUBLE" },
    ],
  },
  sensors: {
    rawColumns: [
      { name: "id", type_name: "VARCHAR", type_text: "VARCHAR" },
      { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
    ],
  },
};

const defaultProps = {
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  goToStep: vi.fn(),
  stepIndex: 2,
  totalSteps: 4,
  isSubmitting: false,
  tables: mockTables,
  experimentId: "test-experiment-id",
  isPreviewOpen: false,
  onPreviewClose: vi.fn(),
};

function renderDataSourceStep(
  opts: { defaultValues?: Partial<ChartFormValues> } & Partial<typeof defaultProps> = {},
) {
  const { defaultValues, ...stepPropOverrides } = opts;
  const stepProps = { ...defaultProps, ...stepPropOverrides };
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourceStep
        {...stepProps}
        form={form}
        step={{
          title: "Data Source",
          description: "Select data source",
          validationSchema: {} as never,
          component: () => null,
        }}
      />
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "",
          description: "",
          chartType: "line",
          chartFamily: "basic",
          dataConfig: { tableName: "", dataSources: [] },
          config: { xAxisTitle: "", yAxisTitle: "" },
          ...defaultValues,
        },
      },
    },
  );
}

function setupExperimentData() {
  vi.mocked(useExperimentData).mockImplementation(({ tableName }: { tableName?: string }) => {
    if (!tableName) {
      return { tableMetadata: undefined, isLoading: false, columns: [], data: [] } as never;
    }
    const table = mockTables.find((t) => t.name === tableName);
    const cols = columnsByTable[tableName];
    return {
      tableMetadata: table && { ...table, ...cols },
      isLoading: false,
      columns: [],
      data: [],
    } as never;
  });
}

describe("DataSourceStep", () => {
  it("renders the data source form with table dropdown", () => {
    setupExperimentData();
    renderDataSourceStep();

    expect(screen.getByText("wizard.steps.dataSource.title")).toBeInTheDocument();
    expect(screen.getByText("wizard.steps.dataSource.description")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders available tables as select options", () => {
    setupExperimentData();
    renderDataSourceStep();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-label", "measurements");
    expect(options[1]).toHaveAttribute("aria-label", "sensors");
  });

  it("renders wizard step navigation buttons", () => {
    setupExperimentData();
    renderDataSourceStep();

    expect(screen.getByRole("button", { name: "experiments.back" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "experiments.next" })).toBeInTheDocument();
  });

  it("disables navigation buttons when submitting", () => {
    setupExperimentData();
    renderDataSourceStep({ isSubmitting: true });

    expect(screen.getByRole("button", { name: "experiments.back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "experiments.next" })).toBeDisabled();
  });

  it("renders line chart configurator when table is selected", () => {
    setupExperimentData();
    renderDataSourceStep({
      defaultValues: {
        chartType: "line",
        dataConfig: { tableName: "measurements", dataSources: [] },
      },
    });

    expect(screen.getByTestId("line-chart-configurator")).toBeInTheDocument();
  });

  it("renders scatter chart configurator for scatter chart type", () => {
    setupExperimentData();
    renderDataSourceStep({
      defaultValues: {
        chartType: "scatter",
        dataConfig: { tableName: "measurements", dataSources: [] },
      },
    });

    expect(screen.getByTestId("scatter-chart-configurator")).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart-configurator")).not.toBeInTheDocument();
  });

  it("does not render configurator when no table is selected", () => {
    setupExperimentData();
    renderDataSourceStep({
      tables: [],
      defaultValues: { dataConfig: { tableName: "", dataSources: [] } },
    });

    expect(screen.queryByTestId("line-chart-configurator")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scatter-chart-configurator")).not.toBeInTheDocument();
  });

  it("renders chart preview modal when table is selected", () => {
    setupExperimentData();
    renderDataSourceStep({
      defaultValues: { dataConfig: { tableName: "measurements", dataSources: [] } },
    });

    const modal = screen.getByTestId("chart-preview-modal");
    expect(within(modal).getByText("Experiment ID: test-experiment-id")).toBeInTheDocument();
    expect(within(modal).getByText("Open: false")).toBeInTheDocument();
  });

  it("passes isPreviewOpen to preview modal", () => {
    setupExperimentData();
    renderDataSourceStep({
      isPreviewOpen: true,
      defaultValues: { dataConfig: { tableName: "measurements", dataSources: [] } },
    });

    const modal = screen.getByTestId("chart-preview-modal");
    expect(within(modal).getByText("Open: true")).toBeInTheDocument();
  });

  it("calls onPreviewClose when preview modal is closed", async () => {
    const user = userEvent.setup();
    setupExperimentData();
    const onPreviewClose = vi.fn();
    renderDataSourceStep({
      isPreviewOpen: true,
      onPreviewClose,
      defaultValues: { dataConfig: { tableName: "measurements", dataSources: [] } },
    });

    await user.click(screen.getByRole("button", { name: "Close Preview" }));
    expect(onPreviewClose).toHaveBeenCalledOnce();
  });

  it("handles unknown chart type gracefully", () => {
    setupExperimentData();
    renderDataSourceStep({
      defaultValues: {
        chartType: "unknown" as "line" | "scatter",
        dataConfig: { tableName: "measurements", dataSources: [] },
      },
    });

    expect(screen.queryByTestId("line-chart-configurator")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scatter-chart-configurator")).not.toBeInTheDocument();
  });

  it("handles empty tables array gracefully", () => {
    setupExperimentData();
    renderDataSourceStep({ tables: [] });

    expect(screen.getByText("wizard.steps.dataSource.title")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("does not show preview modal when no table is selected", () => {
    setupExperimentData();
    renderDataSourceStep({
      tables: [],
      defaultValues: { dataConfig: { tableName: "", dataSources: [] } },
    });

    expect(screen.queryByTestId("chart-preview-modal")).not.toBeInTheDocument();
  });
});
