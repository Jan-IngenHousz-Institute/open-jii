import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { AppearanceStep } from "./appearance-step";

// Mock the appearance configurators
vi.mock("../chart-configurators/appearance", () => ({
  LineChartAppearanceConfigurator: () => (
    <div data-testid="line-chart-appearance-configurator">
      <div>Line Chart Appearance Configurator</div>
    </div>
  ),
  ScatterChartAppearanceConfigurator: () => (
    <div data-testid="scatter-chart-appearance-configurator">
      <div>Scatter Chart Appearance Configurator</div>
    </div>
  ),
}));

// Mock the chart preview modal
vi.mock("../chart-preview/chart-preview-modal", () => ({
  ChartPreviewModal: ({ experimentId, isOpen }: { experimentId: string; isOpen: boolean }) => (
    <div data-testid="chart-preview-modal">
      <div>Preview Modal</div>
      <div>Experiment ID: {experimentId}</div>
      <div>Open: {String(isOpen)}</div>
      <button type="button">Close Preview</button>
    </div>
  ),
}));

describe("AppearanceStep", () => {
  const mockOnNext = vi.fn();
  const mockOnPrevious = vi.fn();
  const mockGoToStep = vi.fn();
  const mockOnPreviewClose = vi.fn();

  const defaultProps = {
    onNext: mockOnNext,
    onPrevious: mockOnPrevious,
    goToStep: mockGoToStep,
    stepIndex: 3,
    totalSteps: 4,
    isSubmitting: false,
    experimentId: "test-experiment-id",
    isPreviewOpen: false,
    onPreviewClose: mockOnPreviewClose,
    step: {
      title: "wizard.steps.appearance.title",
      validationSchema: {} as never,
      component: () => null,
    },
  };

  function renderAppearanceStep(
    opts: {
      defaultValues?: Partial<ChartFormValues>;
      isEdit?: boolean;
    } & Partial<typeof defaultProps> = {},
  ) {
    const { defaultValues, isEdit, ...stepPropOverrides } = opts;
    const stepProps = { ...defaultProps, ...stepPropOverrides };
    return renderWithForm<ChartFormValues>(
      (form) => <AppearanceStep {...stepProps} form={form} isEdit={isEdit} />,
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

  describe("Rendering", () => {
    it("should render the appearance configuration form", () => {
      renderAppearanceStep();

      expect(screen.getByText("wizard.steps.appearance.title")).toBeInTheDocument();
      expect(screen.getByText("wizard.steps.appearance.description")).toBeInTheDocument();
    });

    it("should render wizard step buttons", () => {
      renderAppearanceStep();

      expect(screen.getByRole("button", { name: "experiments.back" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "common.create" })).toBeInTheDocument();
    });

    it("should render line chart appearance configurator for line charts", () => {
      renderAppearanceStep({ defaultValues: { chartType: "line" } });

      expect(screen.getByTestId("line-chart-appearance-configurator")).toBeInTheDocument();
      expect(screen.queryByTestId("scatter-chart-appearance-configurator")).not.toBeInTheDocument();
    });

    it("should render scatter chart appearance configurator for scatter charts", () => {
      renderAppearanceStep({ defaultValues: { chartType: "scatter" } });

      expect(screen.getByTestId("scatter-chart-appearance-configurator")).toBeInTheDocument();
      expect(screen.queryByTestId("line-chart-appearance-configurator")).not.toBeInTheDocument();
    });
  });

  describe("Chart Configurator", () => {
    it("should render line chart configurator for line chart type", () => {
      renderAppearanceStep({ defaultValues: { chartType: "line" } });

      expect(screen.getByTestId("line-chart-appearance-configurator")).toBeInTheDocument();
    });

    it("should render scatter chart configurator for scatter chart type", () => {
      renderAppearanceStep({ defaultValues: { chartType: "scatter" } });

      expect(screen.getByTestId("scatter-chart-appearance-configurator")).toBeInTheDocument();
    });

    it("should not render any configurator for unknown chart type", () => {
      renderAppearanceStep({ defaultValues: { chartType: "unknown" as "line" } });

      expect(screen.queryByTestId("line-chart-appearance-configurator")).not.toBeInTheDocument();
      expect(screen.queryByTestId("scatter-chart-appearance-configurator")).not.toBeInTheDocument();
    });
  });

  describe("Wizard Navigation", () => {
    it("should enable previous button on fourth step", () => {
      renderAppearanceStep({ stepIndex: 3, totalSteps: 4 });

      const previousButton = screen.getByRole("button", { name: "experiments.back" });
      expect(previousButton).toBeEnabled();
    });

    it("should show create button when not submitting (create mode)", () => {
      renderAppearanceStep({ isEdit: false, isSubmitting: false });

      expect(screen.getByRole("button", { name: "common.create" })).toBeInTheDocument();
    });

    it("should show update button when not submitting (edit mode)", () => {
      renderAppearanceStep({ isEdit: true, isSubmitting: false });

      expect(screen.getByRole("button", { name: "common.update" })).toBeInTheDocument();
    });

    it("should show creating label when submitting in create mode", () => {
      renderAppearanceStep({ isEdit: false, isSubmitting: true });

      expect(screen.getByRole("button", { name: "common.creating" })).toBeInTheDocument();
    });

    it("should show updating label when submitting in edit mode", () => {
      renderAppearanceStep({ isEdit: true, isSubmitting: true });

      expect(screen.getByRole("button", { name: "common.updating" })).toBeInTheDocument();
    });

    it("should disable buttons when submitting", () => {
      renderAppearanceStep({ isSubmitting: true });

      expect(screen.getByRole("button", { name: "experiments.back" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "common.creating" })).toBeDisabled();
    });
  });

  describe("Chart Preview Modal", () => {
    it("should render chart preview modal", () => {
      renderAppearanceStep();

      expect(screen.getByTestId("chart-preview-modal")).toBeInTheDocument();
    });

    it("should show preview modal as closed by default", () => {
      renderAppearanceStep({ isPreviewOpen: false });

      expect(screen.getByText("Open: false")).toBeInTheDocument();
    });

    it("should show preview modal as open when isPreviewOpen is true", () => {
      renderAppearanceStep({ isPreviewOpen: true });

      expect(screen.getByText("Open: true")).toBeInTheDocument();
    });

    it("should pass correct experimentId to preview modal", () => {
      renderAppearanceStep({ experimentId: "my-experiment-123" });

      expect(screen.getByText("Experiment ID: my-experiment-123")).toBeInTheDocument();
    });
  });

  describe("Edit Mode", () => {
    it("should use correct labels in create mode", () => {
      renderAppearanceStep({ isEdit: false });

      expect(screen.getByRole("button", { name: "common.create" })).toBeInTheDocument();
    });

    it("should use correct labels in edit mode", () => {
      renderAppearanceStep({ isEdit: true });

      expect(screen.getByRole("button", { name: "common.update" })).toBeInTheDocument();
    });
  });

  describe("Form State", () => {
    it("should render with line chart configuration", () => {
      renderAppearanceStep({
        defaultValues: {
          chartType: "line",
          config: {
            showGrid: true,
            showLegend: true,
            xAxisTitle: "Time",
            yAxisTitle: "Value",
          },
        },
      });

      expect(screen.getByTestId("line-chart-appearance-configurator")).toBeInTheDocument();
    });

    it("should render with scatter chart configuration", () => {
      renderAppearanceStep({
        defaultValues: {
          chartType: "scatter",
          config: {
            showGrid: false,
            showLegend: false,
            xAxisTitle: "X Data",
            yAxisTitle: "Y Data",
          },
        },
      });

      expect(screen.getByTestId("scatter-chart-appearance-configurator")).toBeInTheDocument();
    });
  });
});
