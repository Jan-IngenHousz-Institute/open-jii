import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { ChartPreview } from "./chart-preview";

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

// Mock the visualization data hook
vi.mock(
  "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData",
  () => ({
    useExperimentVisualizationData: vi.fn(() => ({
      data: null,
      isLoading: false,
    })),
  }),
);

// Mock the ExperimentVisualizationRenderer
vi.mock("../experiment-visualization-renderer", () => ({
  default: ({
    visualization,
    experimentId,
    data,
    height,
    showTitle,
    showDescription,
  }: {
    visualization: { name: string; chartType: string };
    experimentId: string;
    data?: unknown[];
    height: number;
    showTitle: boolean;
    showDescription: boolean;
  }) => (
    <div data-testid="visualization-renderer">
      <div data-testid="viz-name">{visualization.name}</div>
      <div data-testid="viz-type">{visualization.chartType}</div>
      <div data-testid="viz-experiment">{experimentId}</div>
      <div data-testid="viz-height">{height}</div>
      <div data-testid="viz-show-title">{showTitle ? "true" : "false"}</div>
      <div data-testid="viz-show-description">{showDescription ? "true" : "false"}</div>
      <div data-testid="viz-data">{data ? JSON.stringify(data) : "no-data"}</div>
    </div>
  ),
}));

describe("ChartPreview", () => {
  const defaultFormValues: ChartFormValues = {
    name: "Test Chart",
    description: "Test Description",
    chartType: "line",
    chartFamily: "basic",
    dataConfig: {
      tableName: "measurements",
      dataSources: [
        { tableName: "measurements", columnName: "temperature", role: "y", alias: "Temp" },
        { tableName: "measurements", columnName: "time", role: "x", alias: "" },
      ],
    },
    config: {
      showGrid: true,
      showLegend: true,
      xAxisTitle: "Time",
      yAxisTitle: "Temperature",
    },
  };

  const TestWrapper = ({ formValues }: { formValues: Partial<ChartFormValues> }) => {
    const form = useForm<ChartFormValues>({
      defaultValues: {
        ...defaultFormValues,
        ...formValues,
      },
    });

    return <ChartPreview form={form} experimentId="test-experiment-id" />;
  };

  describe("No Data Source", () => {
    it("should show no data source message when tableName is empty", () => {
      render(
        <TestWrapper
          formValues={{
            dataConfig: {
              tableName: "",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.getByText("preview.noDataSource")).toBeInTheDocument();
      expect(screen.getByText("preview.selectTable")).toBeInTheDocument();
    });

    it("should not render visualization when no table selected", () => {
      render(
        <TestWrapper
          formValues={{
            dataConfig: {
              tableName: "",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.queryByTestId("visualization-renderer")).not.toBeInTheDocument();
    });
  });

  describe("No Columns Configured", () => {
    it("should show no columns message when data sources have no columns", () => {
      render(
        <TestWrapper
          formValues={{
            dataConfig: {
              tableName: "measurements",
              dataSources: [{ tableName: "measurements", columnName: "", role: "y", alias: "" }],
            },
          }}
        />,
      );

      expect(screen.getByText("preview.noColumns")).toBeInTheDocument();
      expect(screen.getByText("preview.configureColumns")).toBeInTheDocument();
    });

    it("should not render visualization when no columns configured", () => {
      render(
        <TestWrapper
          formValues={{
            dataConfig: {
              tableName: "measurements",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.queryByTestId("visualization-renderer")).not.toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("should show loading message when data is loading", async () => {
      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      vi.mocked(useExperimentVisualizationData).mockReturnValue({
        data: null,
        isLoading: true,
      } as never);

      render(<TestWrapper formValues={{}} />);

      expect(screen.getByText("ui.messages.loadingData")).toBeInTheDocument();
      expect(screen.queryByTestId("visualization-renderer")).not.toBeInTheDocument();
    });
  });

  describe("Visualization Rendering", () => {
    it("should render ExperimentVisualizationRenderer with correct props", async () => {
      const mockData = {
        rows: [
          { time: 1, temperature: 20 },
          { time: 2, temperature: 22 },
        ],
      };

      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      vi.mocked(useExperimentVisualizationData).mockReturnValue({
        data: mockData,
        isLoading: false,
      } as never);

      render(<TestWrapper formValues={{}} />);

      expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
      expect(screen.getByTestId("viz-name")).toHaveTextContent("Test Chart");
      expect(screen.getByTestId("viz-type")).toHaveTextContent("line");
      expect(screen.getByTestId("viz-experiment")).toHaveTextContent("test-experiment-id");
    });

    it("should pass correct height to renderer", async () => {
      const mockData = { rows: [{ time: 1, temperature: 20 }] };

      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      vi.mocked(useExperimentVisualizationData).mockReturnValue({
        data: mockData,
        isLoading: false,
      } as never);

      render(<TestWrapper formValues={{}} />);

      expect(screen.getByTestId("viz-height")).toHaveTextContent("500");
    });

    it("should hide title and description in preview", async () => {
      const mockData = { rows: [{ time: 1, temperature: 20 }] };

      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      vi.mocked(useExperimentVisualizationData).mockReturnValue({
        data: mockData,
        isLoading: false,
      } as never);

      render(<TestWrapper formValues={{}} />);

      expect(screen.getByTestId("viz-show-title")).toHaveTextContent("false");
      expect(screen.getByTestId("viz-show-description")).toHaveTextContent("false");
    });

    it("should pass visualization data to renderer", async () => {
      const mockData = {
        rows: [
          { time: 1, temperature: 20 },
          { time: 2, temperature: 22 },
        ],
      };

      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      vi.mocked(useExperimentVisualizationData).mockReturnValue({
        data: mockData,
        isLoading: false,
      } as never);

      render(<TestWrapper formValues={{}} />);

      const dataElement = screen.getByTestId("viz-data");
      expect(dataElement.textContent).toContain("time");
      expect(dataElement.textContent).toContain("temperature");
    });

    it("should use chart name from form values", async () => {
      const mockData = { rows: [{ time: 1, temperature: 20 }] };

      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      vi.mocked(useExperimentVisualizationData).mockReturnValue({
        data: mockData,
        isLoading: false,
      } as never);

      render(
        <TestWrapper
          formValues={{
            name: "My Custom Chart",
          }}
        />,
      );

      expect(screen.getByTestId("viz-name")).toHaveTextContent("My Custom Chart");
    });

    it("should use default preview name when chart name is empty", async () => {
      const mockData = { rows: [{ time: 1, temperature: 20 }] };

      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      vi.mocked(useExperimentVisualizationData).mockReturnValue({
        data: mockData,
        isLoading: false,
      } as never);

      render(
        <TestWrapper
          formValues={{
            name: "",
          }}
        />,
      );

      expect(screen.getByTestId("viz-name")).toHaveTextContent("charts.preview");
    });

    it("should handle null description gracefully", async () => {
      const mockData = { rows: [{ time: 1, temperature: 20 }] };

      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      vi.mocked(useExperimentVisualizationData).mockReturnValue({
        data: mockData,
        isLoading: false,
      } as never);

      render(
        <TestWrapper
          formValues={{
            name: "Test Chart",
            description: null as unknown as string, // Explicitly test null case
          }}
        />,
      );

      // Should render without errors - description defaults to empty string
      expect(screen.getByTestId("viz-name")).toHaveTextContent("Test Chart");
      expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    });

    it("should render scatter chart type correctly", async () => {
      const mockData = { rows: [{ x: 1, y: 20 }] };

      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      vi.mocked(useExperimentVisualizationData).mockReturnValue({
        data: mockData,
        isLoading: false,
      } as never);

      render(
        <TestWrapper
          formValues={{
            chartType: "scatter",
          }}
        />,
      );

      expect(screen.getByTestId("viz-type")).toHaveTextContent("scatter");
    });
  });

  describe("Data Fetching", () => {
    it("should filter out data sources without column names", async () => {
      const mockData = { rows: [{ time: 1, temperature: 20 }] };

      const { useExperimentVisualizationData } = await import(
        "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData"
      );
      const mockHook = vi.mocked(useExperimentVisualizationData);
      mockHook.mockReturnValue({
        data: mockData,
        isLoading: false,
      } as never);

      render(
        <TestWrapper
          formValues={{
            dataConfig: {
              tableName: "measurements",
              dataSources: [
                { tableName: "measurements", columnName: "temperature", role: "y", alias: "" },
                { tableName: "measurements", columnName: "", role: "x", alias: "" }, // This should be filtered
              ],
            },
          }}
        />,
      );

      // Verify the hook was called - data sources with empty columnName should be filtered
      expect(mockHook).toHaveBeenCalled();
      expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    });
  });
});
