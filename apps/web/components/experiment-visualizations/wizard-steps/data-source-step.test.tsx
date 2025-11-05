import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DataColumn } from "@repo/api";
import { Form } from "@repo/ui/components";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { DataSourceStep } from "./data-source-step";

// Mock dependencies
vi.mock("@repo/i18n", () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    Select: ({ value, children }: { value?: string; children: React.ReactNode }) => {
      const childArray = React.Children.toArray(children);
      return (
        <div data-testid="select-root" data-value={value}>
          {childArray}
        </div>
      );
    },
    SelectTrigger: ({ children }: { children: React.ReactNode }) => (
      <button type="button" role="combobox" data-testid="select-trigger">
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="select-content">{children}</div>
    ),
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <div role="option" data-value={value} aria-label={value}>
        {children}
      </div>
    ),
  };
});

vi.mock("../chart-configurators/data", () => ({
  LineChartDataConfigurator: ({ table }: { table: { name: string } }) => (
    <div data-testid="line-chart-configurator">
      <div>Line Chart Configurator</div>
      <div>Table: {table.name}</div>
    </div>
  ),
  ScatterChartDataConfigurator: ({ table }: { table: { name: string } }) => (
    <div data-testid="scatter-chart-configurator">
      <div>Scatter Chart Configurator</div>
      <div>Table: {table.name}</div>
    </div>
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
      <div>Preview Modal</div>
      <div>Experiment ID: {experimentId}</div>
      <div>Open: {String(isOpen)}</div>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close Preview
      </button>
    </div>
  ),
}));

// Helper to create mock sample tables for testing
const createMockSampleTable = (
  name: string,
  columns: DataColumn[],
  totalRows: number,
): SampleTable => ({
  name,
  columns,
  tableMetadata: {
    // For tests, we can provide a minimal column structure that satisfies the type
    columns: columns.map((col) => ({
      accessorKey: col.name,
      header: col.name,
      cell: (info: { getValue: () => unknown }) => info.getValue(),
    })),
    totalRows,
    totalPages: 1,
  },
  tableRows: [],
});

// Sample tables for testing
const mockTables: SampleTable[] = [
  createMockSampleTable(
    "measurements",
    [
      { name: "timestamp", type_name: "timestamp", type_text: "timestamp" },
      { name: "temperature", type_name: "double", type_text: "double" },
      { name: "humidity", type_name: "double", type_text: "double" },
    ],
    100,
  ),
  createMockSampleTable(
    "sensors",
    [
      { name: "id", type_name: "varchar", type_text: "varchar" },
      { name: "value", type_name: "double", type_text: "double" },
    ],
    50,
  ),
];

describe("DataSourceStep", () => {
  const mockOnNext = vi.fn();
  const mockOnPrevious = vi.fn();
  const mockGoToStep = vi.fn();
  const mockOnPreviewClose = vi.fn();

  const defaultProps = {
    onNext: mockOnNext,
    onPrevious: mockOnPrevious,
    goToStep: mockGoToStep,
    stepIndex: 2,
    totalSteps: 4,
    isSubmitting: false,
    tables: mockTables,
    experimentId: "test-experiment-id",
    isPreviewOpen: false,
    onPreviewClose: mockOnPreviewClose,
  };

  const TestWrapper = ({
    defaultValues,
    ...stepProps
  }: {
    defaultValues?: Partial<ChartFormValues>;
  } & typeof defaultProps) => {
    const form = useForm<ChartFormValues>({
      defaultValues: {
        name: "",
        description: "",
        chartType: "line",
        chartFamily: "basic",
        dataConfig: {
          tableName: "",
          dataSources: [],
        },
        config: {
          xAxisTitle: "",
          yAxisTitle: "",
        },
        ...defaultValues,
      },
    });

    return (
      <Form {...form}>
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
      </Form>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the data source selection form", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByText("wizard.steps.dataSource.title")).toBeInTheDocument();
      expect(screen.getByText("wizard.steps.dataSource.description")).toBeInTheDocument();
    });

    it("should render table selection dropdown", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByText("form.dataSource.title")).toBeInTheDocument();
      expect(screen.getByText("form.dataSource.help")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should render available tables in select options", () => {
      render(<TestWrapper {...defaultProps} />);

      // Check by aria-label (value) since the actual text content is a translation key
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveAttribute("data-value", "measurements");
      expect(options[1]).toHaveAttribute("data-value", "sensors");
    });

    it("should render wizard step buttons", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByRole("button", { name: "experiments.back" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "experiments.next" })).toBeInTheDocument();
    });

    it("should not render chart configurator without table selection", () => {
      render(
        <TestWrapper
          {...defaultProps}
          tables={[]} // No tables available
          defaultValues={{
            dataConfig: {
              tableName: "",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.queryByTestId("line-chart-configurator")).not.toBeInTheDocument();
      expect(screen.queryByTestId("scatter-chart-configurator")).not.toBeInTheDocument();
    });
  });

  describe("Table Selection", () => {
    it("should display table info for each table", () => {
      render(<TestWrapper {...defaultProps} />);

      // Check that both tables are rendered with their info
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);

      // Check data-value attributes
      expect(options[0]).toHaveAttribute("data-value", "measurements");
      expect(options[1]).toHaveAttribute("data-value", "sensors");
    });

    it("should render line chart configurator when table is selected", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            chartType: "line",
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.getByTestId("line-chart-configurator")).toBeInTheDocument();
      expect(screen.getByText("Table: measurements")).toBeInTheDocument();
    });

    it("should render configurator for sensors table when selected", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            chartType: "line",
            dataConfig: {
              tableName: "sensors",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.getByTestId("line-chart-configurator")).toBeInTheDocument();
      expect(screen.getByText("Table: sensors")).toBeInTheDocument();
    });

    it("should handle table selection with existing data sources", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            chartType: "line",
            dataConfig: {
              tableName: "measurements",
              dataSources: [
                { tableName: "measurements", columnName: "temperature", role: "y", alias: "Temp" },
                { tableName: "measurements", columnName: "time", role: "x", alias: "" },
              ],
            },
            config: {
              xAxisTitle: "Time",
              yAxisTitle: "Temperature",
            },
          }}
        />,
      );

      expect(screen.getByTestId("line-chart-configurator")).toBeInTheDocument();
      expect(screen.getByText("Table: measurements")).toBeInTheDocument();
    });
  });

  describe("Chart Configurator", () => {
    it("should render line chart configurator for line charts", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            chartType: "line",
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.getByTestId("line-chart-configurator")).toBeInTheDocument();
      expect(screen.queryByTestId("scatter-chart-configurator")).not.toBeInTheDocument();
    });

    it("should render scatter chart configurator for scatter charts", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            chartType: "scatter",
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.getByTestId("scatter-chart-configurator")).toBeInTheDocument();
      expect(screen.queryByTestId("line-chart-configurator")).not.toBeInTheDocument();
    });

    it("should pass correct table to chart configurator", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            chartType: "line",
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      const configurator = screen.getByTestId("line-chart-configurator");
      expect(within(configurator).getByText("Table: measurements")).toBeInTheDocument();
    });
  });

  describe("Wizard Navigation", () => {
    it("should enable previous button on third step", () => {
      render(<TestWrapper {...defaultProps} />);

      const previousButton = screen.getByRole("button", { name: "experiments.back" });
      expect(previousButton).toBeEnabled();
    });

    it("should show next button when not on last step", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByRole("button", { name: "experiments.next" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "common.create" })).not.toBeInTheDocument();
    });

    it("should disable buttons when submitting", () => {
      render(<TestWrapper {...defaultProps} isSubmitting={true} />);

      expect(screen.getByRole("button", { name: "experiments.back" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "experiments.next" })).toBeDisabled();
    });
  });

  describe("Chart Preview Modal", () => {
    it("should render chart preview modal when table is selected", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.getByTestId("chart-preview-modal")).toBeInTheDocument();
    });

    it("should show preview modal as closed by default", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      const previewModal = screen.getByTestId("chart-preview-modal");
      expect(within(previewModal).getByText("Open: false")).toBeInTheDocument();
    });

    it("should show preview modal as open when isPreviewOpen is true", () => {
      render(
        <TestWrapper
          {...defaultProps}
          isPreviewOpen={true}
          defaultValues={{
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      const previewModal = screen.getByTestId("chart-preview-modal");
      expect(within(previewModal).getByText("Open: true")).toBeInTheDocument();
    });

    it("should call onPreviewClose when preview modal is closed", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper
          {...defaultProps}
          isPreviewOpen={true}
          defaultValues={{
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      const closeButton = screen.getByRole("button", { name: "Close Preview" });
      await user.click(closeButton);

      expect(mockOnPreviewClose).toHaveBeenCalledOnce();
    });

    it("should pass correct experimentId to preview modal", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      const previewModal = screen.getByTestId("chart-preview-modal");
      expect(
        within(previewModal).getByText("Experiment ID: test-experiment-id"),
      ).toBeInTheDocument();
    });
  });

  describe("Initial State", () => {
    it("should preserve tableName from form values", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            dataConfig: {
              tableName: "sensors",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.getByTestId("line-chart-configurator")).toBeInTheDocument();
      expect(screen.getByText("Table: sensors")).toBeInTheDocument();
    });

    it("should handle empty tables array gracefully", () => {
      render(<TestWrapper {...defaultProps} tables={[]} />);

      expect(screen.getByText("wizard.steps.dataSource.title")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  describe("Form State", () => {
    it("should render with provided data sources", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            chartType: "line",
            dataConfig: {
              tableName: "measurements",
              dataSources: [
                { tableName: "measurements", columnName: "temperature", role: "y", alias: "temp" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByTestId("line-chart-configurator")).toBeInTheDocument();
    });

    it("should render with axis titles in config", () => {
      render(
        <TestWrapper
          {...defaultProps}
          defaultValues={{
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
            config: {
              xAxisTitle: "Time",
              yAxisTitle: "Temperature",
            },
          }}
        />,
      );

      expect(screen.getByTestId("line-chart-configurator")).toBeInTheDocument();
    });
  });
});
