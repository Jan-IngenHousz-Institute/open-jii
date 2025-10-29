/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualizationUpdate } from "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExperimentVisualization } from "@repo/api";
import type { WizardFormProps } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import EditVisualizationForm from "./edit-visualization-form";

vi.mock("@repo/i18n", () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

vi.mock(
  "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate",
  () => ({
    useExperimentVisualizationUpdate: vi.fn(),
  }),
);

vi.mock("@repo/ui/components", () => ({
  WizardForm: vi.fn(
    ({ onSubmit, defaultValues, isSubmitting, steps, initialStep = 0 }: WizardFormProps) => {
      const StepComponent = steps[initialStep].component;

      return (
        <form
          data-testid="wizard-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(defaultValues as any);
          }}
        >
          <div data-testid="is-submitting">{isSubmitting ? "true" : "false"}</div>
          <div data-testid="step-content">
            <StepComponent
              form={{} as any}
              step={steps[initialStep]}
              onNext={() => undefined}
              onPrevious={() => undefined}
              goToStep={() => undefined}
              stepIndex={initialStep}
              totalSteps={steps.length}
              isSubmitting={isSubmitting}
            />
          </div>
          <button type="submit" data-testid="submit-button">
            Submit
          </button>
        </form>
      );
    },
  ),
}));

vi.mock("./wizard-steps/basic-info-step", () => ({
  BasicInfoStep: vi.fn(() => <div>Basic Info Step</div>),
  basicInfoSchema: vi.fn(() => ({})),
}));

vi.mock("./wizard-steps/chart-type-step", () => ({
  ChartTypeStep: vi.fn(() => <div>Chart Type Step</div>),
  chartTypeSchema: vi.fn(() => ({})),
}));

vi.mock("./wizard-steps/data-source-step", () => ({
  DataSourceStep: vi.fn(() => <div>Data Source Step</div>),
  dataSourceSchema: vi.fn(() => ({})),
}));

vi.mock("./wizard-steps/appearance-step", () => ({
  AppearanceStep: vi.fn(() => <div>Appearance Step</div>),
  appearanceSchema: vi.fn(() => ({})),
}));

vi.mock("./chart-configurators/chart-configurator-util", () => ({
  getDefaultChartConfig: vi.fn((chartType: string) => ({
    defaultConfig: `config-for-${chartType}`,
  })),
}));

describe("EditVisualizationForm", () => {
  const mockExperimentId = "exp-123";
  const mockVisualizationId = "viz-456";
  const mockOnSuccess = vi.fn();
  const mockOnPreviewClose = vi.fn();

  const mockVisualization: ExperimentVisualization = {
    id: mockVisualizationId,
    name: "Test Visualization",
    description: "A test description",
    experimentId: mockExperimentId,
    chartFamily: "basic",
    chartType: "line",
    config: {
      existingConfig: "value",
    },
    dataConfig: {
      tableName: "test_table",
      dataSources: [
        { tableName: "test_table", columnName: "x", role: "x" },
        { tableName: "test_table", columnName: "y", role: "y" },
      ],
    },
    createdBy: "user-123",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockSampleTables: SampleTable[] = [
    {
      name: "test_table",
      totalRows: 100,
      tableMetadata: {} as never,
      tableRows: [],
      columns: [
        { name: "x", type_name: "DOUBLE", type_text: "double" },
        { name: "y", type_name: "DOUBLE", type_text: "double" },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should render loading spinner when isLoading is true", () => {
      const mockUpdateMutate = vi.fn();
      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
      });

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={mockVisualization}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={true}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      const loader = document.querySelector(".animate-spin");
      expect(loader).toBeInTheDocument();
    });
  });

  describe("Form Rendering", () => {
    it("should render the wizard form when not loading", () => {
      const mockUpdateMutate = vi.fn();
      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
      });

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={mockVisualization}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={false}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      expect(screen.getByTestId("wizard-form")).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should call update mutation with correct data on submit", async () => {
      const user = userEvent.setup();
      const mockUpdateMutate = vi.fn();

      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
      });

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={mockVisualization}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={false}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      const submitButton = screen.getByTestId("submit-button");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith({
          params: {
            id: mockExperimentId,
            visualizationId: mockVisualizationId,
          },
          body: expect.objectContaining({
            name: "Test Visualization",
            description: "A test description",
            chartFamily: "basic",
            chartType: "line",
          }),
        });
      });
    });

    it("should filter out empty data sources on submit", async () => {
      const user = userEvent.setup();
      const mockUpdateMutate = vi.fn();

      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
      });

      const visualizationWithEmptySource = {
        ...mockVisualization,
        dataConfig: {
          tableName: "test_table",
          dataSources: [
            { tableName: "test_table", columnName: "x", role: "x" },
            { tableName: "test_table", columnName: "", role: "y" },
            { tableName: "test_table", columnName: "z", role: "z" },
          ],
        },
      };

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={visualizationWithEmptySource}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={false}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      const submitButton = screen.getByTestId("submit-button");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalled();
        const callArgs = mockUpdateMutate.mock.calls[0][0];
        expect(callArgs.body.dataConfig.dataSources).toHaveLength(2);
        expect(callArgs.body.dataConfig.dataSources[0].columnName).toBe("x");
        expect(callArgs.body.dataConfig.dataSources[1].columnName).toBe("z");
      });
    });

    it("should filter out whitespace-only column names", async () => {
      const user = userEvent.setup();
      const mockUpdateMutate = vi.fn();

      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
      });

      const visualizationWithWhitespace = {
        ...mockVisualization,
        dataConfig: {
          tableName: "test_table",
          dataSources: [
            { tableName: "test_table", columnName: "x", role: "x" },
            { tableName: "test_table", columnName: "   ", role: "y" },
            { tableName: "test_table", columnName: "z", role: "z" },
          ],
        },
      };

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={visualizationWithWhitespace}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={false}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      const submitButton = screen.getByTestId("submit-button");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalled();
        const callArgs = mockUpdateMutate.mock.calls[0][0];
        expect(callArgs.body.dataConfig.dataSources).toHaveLength(2);
      });
    });

    it("should preserve data source aliases when filtering", async () => {
      const user = userEvent.setup();
      const mockUpdateMutate = vi.fn();

      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
      });

      const visualizationWithAliases = {
        ...mockVisualization,
        dataConfig: {
          tableName: "test_table",
          dataSources: [
            { tableName: "test_table", columnName: "x", role: "x", alias: "Time" },
            { tableName: "test_table", columnName: "", role: "y", alias: "Empty" },
            { tableName: "test_table", columnName: "z", role: "z", alias: "Value" },
          ],
        },
      };

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={visualizationWithAliases}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={false}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      const submitButton = screen.getByTestId("submit-button");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalled();
        const callArgs = mockUpdateMutate.mock.calls[0][0];
        expect(callArgs.body.dataConfig.dataSources[0].alias).toBe("Time");
        expect(callArgs.body.dataConfig.dataSources[1].alias).toBe("Value");
      });
    });
  });

  describe("Success Handling", () => {
    it("should show toast and call onSuccess when update succeeds", async () => {
      let onSuccessCallback: ((data: ExperimentVisualization) => void) | undefined;

      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockImplementation(
        ({ onSuccess }: { onSuccess?: (data: ExperimentVisualization) => void }) => {
          onSuccessCallback = onSuccess;
          return {
            mutate: vi.fn(),
            isPending: false,
          };
        },
      );

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={mockVisualization}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={false}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      const updatedVisualization = { ...mockVisualization, name: "Updated Name" };
      onSuccessCallback?.(updatedVisualization);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          description: "ui.messages.updateSuccess",
        });
        expect(mockOnSuccess).toHaveBeenCalledWith(mockVisualizationId);
      });
    });
  });

  describe("Config Merging", () => {
    it("should call getDefaultChartConfig with correct chart type", async () => {
      const mockUpdateMutate = vi.fn();

      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
      });

      const { getDefaultChartConfig } = await import(
        "./chart-configurators/chart-configurator-util"
      );

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={mockVisualization}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={false}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      expect(getDefaultChartConfig).toHaveBeenCalledWith("line");
    });
  });

  describe("Null Description Handling", () => {
    it("should handle null description by using empty string", () => {
      const mockUpdateMutate = vi.fn();
      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
      });

      const visualizationWithoutDesc = {
        ...mockVisualization,
        description: null,
      };

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={visualizationWithoutDesc}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={false}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      expect(screen.getByTestId("wizard-form")).toBeInTheDocument();
    });
  });

  describe("Submitting State", () => {
    it("should pass isSubmitting to wizard form", () => {
      const mockUpdateMutate = vi.fn();
      (useExperimentVisualizationUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: true,
      });

      render(
        <EditVisualizationForm
          experimentId={mockExperimentId}
          visualization={mockVisualization}
          sampleTables={mockSampleTables}
          onSuccess={mockOnSuccess}
          isLoading={false}
          isPreviewOpen={false}
          onPreviewClose={mockOnPreviewClose}
        />,
      );

      expect(screen.getByTestId("is-submitting")).toHaveTextContent("true");
    });
  });
});
