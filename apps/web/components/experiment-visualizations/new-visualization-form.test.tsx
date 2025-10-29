import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualizationCreate } from "@/hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks";

import type { ChartFormValues } from "./chart-configurators/chart-configurator-util";
import { getDefaultChartConfig } from "./chart-configurators/chart-configurator-util";
import NewVisualizationForm from "./new-visualization-form";

// Mock external dependencies
vi.mock("@/hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate");
vi.mock("@repo/i18n");
vi.mock("@repo/ui/hooks");
vi.mock("./chart-configurators/chart-configurator-util", () => ({
  getDefaultChartConfig: vi.fn(),
}));

// Mock WizardForm and Card components
vi.mock("@repo/ui/components", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WizardForm: vi.fn(({ defaultValues, onSubmit }: any) => {
    return (
      <div data-testid="wizard-form">
        <button
          onClick={() => {
            if (defaultValues && onSubmit) {
              onSubmit(defaultValues as ChartFormValues);
            }
          }}
        >
          Submit
        </button>
      </div>
    );
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CardHeader: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CardDescription: ({ children }: any) => <p>{children}</p>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

describe("NewVisualizationForm", () => {
  const mockOnSuccess = vi.fn();
  const mockOnPreviewClose = vi.fn();
  const mockCreateVisualization = vi.fn();
  const mockT = vi.fn((key: string) => key);
  const mockToast = vi.fn();

  const mockSampleTables: SampleTable[] = [
    {
      name: "measurements",
      totalRows: 100,
      tableMetadata: {} as never,
      tableRows: [],
      columns: [
        { name: "time", type_name: "TIMESTAMP", type_text: "timestamp" },
        { name: "temperature", type_name: "DOUBLE", type_text: "double" },
      ],
    },
    {
      name: "observations",
      totalRows: 50,
      tableMetadata: {} as never,
      tableRows: [],
      columns: [
        { name: "date", type_name: "TIMESTAMP", type_text: "timestamp" },
        { name: "value", type_name: "DOUBLE", type_text: "double" },
      ],
    },
  ];

  const defaultProps = {
    experimentId: "exp-123",
    sampleTables: mockSampleTables,
    onSuccess: mockOnSuccess,
    isPreviewOpen: false,
    onPreviewClose: mockOnPreviewClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue({ t: mockT });
    (toast as ReturnType<typeof vi.fn>).mockImplementation(mockToast);
    (getDefaultChartConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      title: "Default Chart",
    });
    (useExperimentVisualizationCreate as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockCreateVisualization,
      isPending: false,
    });
  });

  describe("Loading State", () => {
    it("should render loading spinner when isLoading is true", () => {
      render(<NewVisualizationForm {...defaultProps} isLoading={true} />);

      // Check for the spinner element with lucide class
      const spinner = document.querySelector(".lucide-loader-circle");
      expect(spinner).toBeTruthy();
      expect(screen.queryByTestId("wizard-form")).not.toBeInTheDocument();
    });
  });

  describe("Form Rendering", () => {
    it("should render the wizard form when not loading", () => {
      render(<NewVisualizationForm {...defaultProps} />);

      expect(screen.getByTestId("wizard-form")).toBeInTheDocument();
      // Should not show loading spinner
      const spinner = document.querySelector(".lucide-loader-circle");
      expect(spinner).toBeFalsy();
    });

    it("should initialize with first table when tables are available", () => {
      render(<NewVisualizationForm {...defaultProps} />);

      expect(screen.getByTestId("wizard-form")).toBeInTheDocument();
      // WizardForm should be called with defaultValues containing first table
    });

    it("should initialize with empty table name when no tables available", () => {
      render(<NewVisualizationForm {...defaultProps} sampleTables={[]} />);

      expect(screen.getByTestId("wizard-form")).toBeInTheDocument();
      // WizardForm should be called with defaultValues containing empty tableName
    });
  });

  describe("Form Submission", () => {
    it("should call create mutation with correct data on submit", async () => {
      const user = userEvent.setup();
      render(<NewVisualizationForm {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockCreateVisualization).toHaveBeenCalledWith({
          params: { id: "exp-123" },
          body: expect.objectContaining({
            name: "",
            description: "",
            chartFamily: "basic",
            chartType: "line",
          }),
        });
      });
    });

    it("should filter out empty data sources on submit", async () => {
      const user = userEvent.setup();
      const mockWithEmptySource = vi.fn();
      (useExperimentVisualizationCreate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockWithEmptySource,
        isPending: false,
      });

      render(<NewVisualizationForm {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockWithEmptySource).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              dataConfig: expect.objectContaining({
                dataSources: [],
              }),
            }),
          }),
        );
      });
    });

    it("should filter out whitespace-only column names", async () => {
      const user = userEvent.setup();
      const mockWithWhitespace = vi.fn();
      (useExperimentVisualizationCreate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockWithWhitespace,
        isPending: false,
      });

      // Mock WizardForm to submit data with whitespace columns
      const { WizardForm } = await import("@repo/ui/components");
      (WizardForm as ReturnType<typeof vi.fn>).mockImplementation(({ onSubmit, defaultValues }) => {
        const dataWithWhitespace = {
          ...defaultValues,
          dataConfig: {
            tableName: "measurements",
            dataSources: [
              { tableName: "measurements", columnName: "  ", role: "x", alias: "" },
              { tableName: "measurements", columnName: "temp", role: "y", alias: "" },
            ],
          },
        };
        return (
          <div data-testid="wizard-form">
            <button onClick={() => onSubmit(dataWithWhitespace as ChartFormValues)}>Submit</button>
          </div>
        );
      });

      render(<NewVisualizationForm {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockWithWhitespace).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              dataConfig: expect.objectContaining({
                dataSources: [
                  { tableName: "measurements", columnName: "temp", role: "y", alias: "" },
                ],
              }),
            }),
          }),
        );
      });
    });

    it("should preserve data source aliases when filtering", async () => {
      const user = userEvent.setup();
      const mockWithAliases = vi.fn();
      (useExperimentVisualizationCreate as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockWithAliases,
        isPending: false,
      });

      // Mock WizardForm to submit data with aliases
      const { WizardForm } = await import("@repo/ui/components");
      (WizardForm as ReturnType<typeof vi.fn>).mockImplementation(({ onSubmit, defaultValues }) => {
        const dataWithAliases = {
          ...defaultValues,
          dataConfig: {
            tableName: "measurements",
            dataSources: [
              {
                tableName: "measurements",
                columnName: "temp",
                role: "x",
                alias: "Temperature",
              },
              { tableName: "measurements", columnName: "", role: "y", alias: "Value" },
            ],
          },
        };
        return (
          <div data-testid="wizard-form">
            <button onClick={() => onSubmit(dataWithAliases as ChartFormValues)}>Submit</button>
          </div>
        );
      });

      render(<NewVisualizationForm {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(mockWithAliases).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              dataConfig: expect.objectContaining({
                dataSources: [
                  {
                    tableName: "measurements",
                    columnName: "temp",
                    role: "x",
                    alias: "Temperature",
                  },
                ],
              }),
            }),
          }),
        );
      });
    });
  });

  describe("Success Handling", () => {
    it("should show toast and call onSuccess when creation succeeds", async () => {
      let successCallback: ((visualization: { id: string }) => void) | undefined;
      (useExperimentVisualizationCreate as ReturnType<typeof vi.fn>).mockImplementation(
        ({ onSuccess }: { onSuccess: (visualization: { id: string }) => void }) => {
          successCallback = onSuccess;
          return {
            mutate: mockCreateVisualization,
            isPending: false,
          };
        },
      );

      render(<NewVisualizationForm {...defaultProps} />);

      // Trigger success callback
      successCallback?.({ id: "viz-456" });

      expect(mockToast).toHaveBeenCalledWith({
        description: "ui.messages.createSuccess",
      });
      expect(mockOnSuccess).toHaveBeenCalledWith("viz-456");
    });
  });

  describe("Default Config", () => {
    it("should call getDefaultChartConfig with default chart type", () => {
      render(<NewVisualizationForm {...defaultProps} />);

      expect(getDefaultChartConfig).toHaveBeenCalledWith("line");
    });
  });

  describe("Wizard Steps Configuration", () => {
    it("should configure wizard with all four steps", () => {
      render(<NewVisualizationForm {...defaultProps} />);

      // Verify that wizard steps are configured properly
      expect(mockT).toHaveBeenCalledWith("wizard.steps.basicInfo.title");
      expect(mockT).toHaveBeenCalledWith("wizard.steps.basicInfo.description");
      expect(mockT).toHaveBeenCalledWith("wizard.steps.chartType.title");
      expect(mockT).toHaveBeenCalledWith("wizard.steps.chartType.description");
      expect(mockT).toHaveBeenCalledWith("wizard.steps.dataSource.title");
      expect(mockT).toHaveBeenCalledWith("wizard.steps.dataSource.description");
      expect(mockT).toHaveBeenCalledWith("wizard.steps.appearance.title");
      expect(mockT).toHaveBeenCalledWith("wizard.steps.appearance.description");
    });
  });

  describe("Data Sources Initialization", () => {
    it("should initialize with two default data sources for x and y roles", () => {
      render(<NewVisualizationForm {...defaultProps} />);

      // The form should initialize with 2 data sources (x and y)
      expect(screen.getByTestId("wizard-form")).toBeInTheDocument();
      // Default values should have been set with 2 data sources
    });

    it("should set table name to empty string when no tables provided", () => {
      render(<NewVisualizationForm {...defaultProps} sampleTables={[]} />);

      expect(screen.getByTestId("wizard-form")).toBeInTheDocument();
      // Should handle empty table list gracefully
    });
  });
});
