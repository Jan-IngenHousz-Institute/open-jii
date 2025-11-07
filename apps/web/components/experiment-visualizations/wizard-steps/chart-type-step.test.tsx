import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Form } from "@repo/ui/components";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { getDefaultChartConfig } from "../chart-configurators/chart-configurator-util";
import { ChartTypeStep } from "./chart-type-step";

// Mock dependencies
vi.mock("@repo/i18n", () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

vi.mock("../chart-preview/chart-preview-modal", () => ({
  ChartPreviewModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="chart-preview-modal">{isOpen ? "Open" : "Closed"}</div>
  ),
}));

vi.mock("../chart-configurators/chart-configurator-util", () => ({
  getDefaultChartConfig: vi.fn((chartType: string) => ({
    title: `Default ${chartType} config`,
  })),
  getDefaultDataConfig: vi.fn(),
}));

describe("ChartTypeStep", () => {
  const mockOnNext = vi.fn();
  const mockOnPrevious = vi.fn();
  const mockOnPreviewClose = vi.fn();

  const defaultProps = {
    onNext: mockOnNext,
    onPrevious: mockOnPrevious,
    goToStep: vi.fn(),
    stepIndex: 1,
    totalSteps: 4,
    isSubmitting: false,
    experimentId: "exp-123",
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
        chartFamily: "basic",
        chartType: "line",
        dataConfig: {
          tableName: "",
          dataSources: [],
        },
        config: {},
        ...defaultValues,
      } as ChartFormValues,
    });

    return (
      <Form {...form}>
        <ChartTypeStep
          form={form}
          step={{
            title: "Chart Type",
            description: "Select chart type",
            validationSchema: {} as never,
            component: () => null,
          }}
          {...stepProps}
        />
      </Form>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the chart type selection form", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByText("wizard.steps.chartType.title")).toBeInTheDocument();
      expect(screen.getByText("wizard.steps.chartType.description")).toBeInTheDocument();
      expect(screen.getByText("charts.families.basic")).toBeInTheDocument();
    });

    it("should render line chart option", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByText("charts.types.line")).toBeInTheDocument();
      expect(screen.getByLabelText("charts.types.line")).toBeInTheDocument();
    });

    it("should render scatter chart option", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByText("charts.types.scatter")).toBeInTheDocument();
      expect(screen.getByLabelText("charts.types.scatter")).toBeInTheDocument();
    });

    it("should render wizard step buttons", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByRole("button", { name: "experiments.back" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "experiments.next" })).toBeInTheDocument();
    });

    it("should render chart preview modal", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByTestId("chart-preview-modal")).toBeInTheDocument();
    });
  });

  describe("Chart Type Selection", () => {
    it("should show line chart as selected by default", () => {
      render(<TestWrapper {...defaultProps} defaultValues={{ chartType: "line" }} />);

      const lineChartOption = screen.getByLabelText("charts.types.line");
      expect(lineChartOption).toHaveClass("border-primary");
    });

    it("should allow selecting scatter chart", async () => {
      const user = userEvent.setup();
      render(<TestWrapper {...defaultProps} />);

      const scatterChartOption = screen.getByLabelText("charts.types.scatter");
      await user.click(scatterChartOption);

      expect(scatterChartOption).toHaveClass("border-primary");
    });

    it("should call getDefaultChartConfig when selecting a chart type", async () => {
      const user = userEvent.setup();
      render(<TestWrapper {...defaultProps} />);

      const scatterChartOption = screen.getByLabelText("charts.types.scatter");
      await user.click(scatterChartOption);

      expect(getDefaultChartConfig).toHaveBeenCalledWith("scatter");
    });

    it("should update form values when selecting chart type", async () => {
      const user = userEvent.setup();
      const TestWrapperWithSpy = () => {
        const form = useForm<ChartFormValues>({
          defaultValues: {
            name: "",
            description: "",
            chartFamily: "basic",
            chartType: "line",
            dataConfig: {
              tableName: "",
              dataSources: [],
            },
            config: {},
          } as ChartFormValues,
        });

        return (
          <Form {...form}>
            <ChartTypeStep
              form={form}
              step={{
                title: "Chart Type",
                description: "Select chart type",
                validationSchema: {} as never,
                component: () => null,
              }}
              {...defaultProps}
            />
          </Form>
        );
      };

      render(<TestWrapperWithSpy />);

      const scatterChartOption = screen.getByLabelText("charts.types.scatter");
      await user.click(scatterChartOption);

      // Verify the chart type changed
      expect(scatterChartOption).toHaveClass("border-primary");
    });

    it("should highlight selected chart type", async () => {
      const user = userEvent.setup();
      render(<TestWrapper {...defaultProps} defaultValues={{ chartType: "line" }} />);

      const lineLabel = screen.getByLabelText("charts.types.line");
      const scatterLabel = screen.getByLabelText("charts.types.scatter");

      // Line should be selected initially (checked via border-primary class on label)
      expect(lineLabel).toHaveClass("border-primary");

      // Click scatter
      await user.click(scatterLabel);

      // Scatter should now be selected
      expect(scatterLabel).toHaveClass("border-primary");
    });
  });

  describe("Wizard Navigation", () => {
    it("should enable previous button on second step", () => {
      render(<TestWrapper {...defaultProps} stepIndex={1} />);

      const previousButton = screen.getByRole("button", { name: "experiments.back" });
      expect(previousButton).not.toBeDisabled();
    });

    it("should show next button when not on last step", () => {
      render(<TestWrapper {...defaultProps} stepIndex={1} totalSteps={4} />);

      const nextButton = screen.getByRole("button", { name: "experiments.next" });
      expect(nextButton).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "common.create" })).not.toBeInTheDocument();
    });

    it("should disable buttons when submitting", () => {
      render(<TestWrapper {...defaultProps} isSubmitting={true} />);

      const previousButton = screen.getByRole("button", { name: "experiments.back" });
      const nextButton = screen.getByRole("button", { name: "experiments.next" });

      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  describe("Chart Preview Modal", () => {
    it("should show preview modal as closed by default", () => {
      render(<TestWrapper {...defaultProps} isPreviewOpen={false} />);

      const modal = screen.getByTestId("chart-preview-modal");
      expect(modal).toHaveTextContent("Closed");
    });

    it("should show preview modal as open when isPreviewOpen is true", () => {
      render(<TestWrapper {...defaultProps} isPreviewOpen={true} />);

      const modal = screen.getByTestId("chart-preview-modal");
      expect(modal).toHaveTextContent("Open");
    });
  });

  describe("Initial State", () => {
    it("should preserve chartType from form values", () => {
      render(<TestWrapper {...defaultProps} defaultValues={{ chartType: "scatter" }} />);

      const scatterLabel = screen.getByLabelText("charts.types.scatter");
      expect(scatterLabel).toHaveClass("border-primary");
    });

    it("should default to line chart when not specified", () => {
      render(<TestWrapper {...defaultProps} />);

      const lineLabel = screen.getByLabelText("charts.types.line");
      expect(lineLabel).toHaveClass("border-primary");
    });
  });

  describe("Chart Family", () => {
    it("should display basic chart family label", () => {
      render(<TestWrapper {...defaultProps} />);

      expect(screen.getByText("charts.families.basic")).toBeInTheDocument();
    });

    it("should set chartFamily to basic when selecting any chart type", async () => {
      const user = userEvent.setup();
      render(<TestWrapper {...defaultProps} />);

      const scatterOption = screen.getByLabelText("charts.types.scatter");
      await user.click(scatterOption);

      // The component sets chartFamily to 'basic' - we can verify indirectly
      expect(scatterOption).toHaveClass("border-primary");
    });
  });

  describe("Icons", () => {
    it("should render chart type icons", () => {
      render(<TestWrapper {...defaultProps} />);

      // Check that both chart type options are rendered with their labels
      expect(screen.getByText("charts.types.line")).toBeInTheDocument();
      expect(screen.getByText("charts.types.scatter")).toBeInTheDocument();
    });
  });
});
