import { render, screen, waitFor } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ExperimentVisualization } from "@repo/api";

import { useExperimentVisualizationData } from "../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import ExperimentVisualizationsDisplay from "./experiment-visualizations-display";

// Mock the visualization renderer component
vi.mock("./experiment-visualization-renderer", () => ({
  default: vi.fn(
    ({ visualization, data }: { visualization?: ExperimentVisualization; data?: unknown }) => (
      <div data-testid="visualization-renderer">
        <div data-testid="viz-id">{visualization?.id}</div>
        <div data-testid="viz-name">{visualization?.name}</div>
        <div data-testid="viz-data">{data ? "has-data" : "no-data"}</div>
      </div>
    ),
  ),
}));

// Mock the visualization data hook
vi.mock(
  "../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData",
  () => ({
    useExperimentVisualizationData: vi.fn(),
  }),
);

describe("ExperimentVisualizationsDisplay", () => {
  const mockExperimentId = "exp-123";
  const mockUseExperimentVisualizationData = vi.mocked(useExperimentVisualizationData);
  const mockVisualizations: ExperimentVisualization[] = [
    {
      id: "viz-1",
      name: "Line Chart Visualization",
      description: "A visualization showing trends over time",
      experimentId: mockExperimentId,
      chartFamily: "basic",
      chartType: "line",
      config: {},
      dataConfig: {
        tableName: "measurements",
        dataSources: [
          { tableName: "measurements", columnName: "timestamp", role: "x" },
          { tableName: "measurements", columnName: "value", role: "y" },
        ],
      },
      createdBy: "user-1",
      createdByName: "User One",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
    {
      id: "viz-2",
      name: "Scatter Plot",
      description:
        "A scatter plot showing correlations between variables with a very long description that should be truncated",
      experimentId: mockExperimentId,
      chartFamily: "basic",
      chartType: "scatter",
      config: {},
      dataConfig: {
        tableName: "measurements",
        dataSources: [
          { tableName: "measurements", columnName: "x_value", role: "x" },
          { tableName: "measurements", columnName: "y_value", role: "y" },
        ],
      },
      createdBy: "user-1",
      createdByName: "User One",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockUseExperimentVisualizationData.mockReturnValue({
      data: {
        columns: [
          { name: "timestamp", type_name: "string", type_text: "string" },
          { name: "value", type_name: "number", type_text: "number" },
        ],
        rows: [{ timestamp: "2023-01-01", value: 10 }],
        totalRows: 1,
        truncated: false,
      },
      tableInfo: {
        name: "measurements",
        catalog_name: "default",
        schema_name: "default",
        totalRows: 1,
      },
      isLoading: false,
      error: null,
    });
  });

  it("should render loading state", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={[]}
        isLoading={true}
      />,
    );

    expect(screen.getByText("ui.title")).toBeInTheDocument();
    expect(screen.getByText("selector.noVisualizations")).toBeInTheDocument();
    // Should show loading skeleton
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("should render no visualizations message when empty", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={[]}
        isLoading={false}
      />,
    );

    expect(screen.getByText("selector.noVisualizations")).toBeInTheDocument();
  });

  it("should auto-select first visualization", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    // Should show the combobox with the selected visualization
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    // Should render the visualization renderer with the correct data
    expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("viz-id")).toHaveTextContent("viz-1");
    expect(screen.getByTestId("viz-name")).toHaveTextContent("Line Chart Visualization");
  });

  it("should render visualization options in select", async () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp1"
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Should have a select dropdown button for visualization selection
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    // Should render the visualization with correct name in the renderer
    expect(screen.getByTestId("viz-name")).toHaveTextContent("Line Chart Visualization");
  });

  it("should truncate long descriptions", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    // The first visualization is auto-selected and shown by default
    expect(screen.getByTestId("viz-name")).toHaveTextContent("Line Chart Visualization");
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("should render visualization renderer when data is loaded", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    // Should show the visualization in the renderer
    expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("viz-name")).toHaveTextContent("Line Chart Visualization");
    expect(screen.getByTestId("viz-data")).toHaveTextContent("has-data");
  });

  it("should show loading state for visualization data", () => {
    mockUseExperimentVisualizationData.mockReturnValue({
      data: undefined,
      tableInfo: undefined,
      isLoading: true,
      error: null,
    });

    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    expect(screen.getByText("ui.messages.loadingData")).toBeInTheDocument();
  });

  it("should call hook with correct parameters for selected visualization", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    expect(mockUseExperimentVisualizationData).toHaveBeenCalledWith(
      mockExperimentId,
      {
        tableName: "measurements",
        columns: ["timestamp", "value"],
        orderBy: "timestamp",
        orderDirection: "ASC",
      },
      true,
    );
  });

  it("should call hook with fallback parameters when no visualization selected", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={[]}
        isLoading={false}
      />,
    );

    expect(mockUseExperimentVisualizationData).toHaveBeenCalledWith(
      mockExperimentId,
      {
        tableName: "",
        columns: [],
      },
      false,
    );
  });

  it("should pass visualization data to renderer", () => {
    const mockData = {
      columns: [
        { name: "x", type_name: "number", type_text: "number" },
        { name: "y", type_name: "number", type_text: "number" },
      ],
      rows: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      totalRows: 2,
      truncated: false,
    };
    mockUseExperimentVisualizationData.mockReturnValue({
      data: mockData,
      tableInfo: {
        name: "measurements",
        catalog_name: "default",
        schema_name: "default",
        totalRows: 2,
      },
      isLoading: false,
      error: null,
    });

    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    // Should render the visualization with data
    expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("viz-data")).toHaveTextContent("has-data");
    expect(screen.getByTestId("viz-name")).toHaveTextContent("Line Chart Visualization");
  });

  it("should pass null data when no data available", () => {
    mockUseExperimentVisualizationData.mockReturnValue({
      data: undefined,
      tableInfo: undefined,
      isLoading: false,
      error: null,
    });

    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    // Should still render the visualization but with no data
    expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("viz-data")).toHaveTextContent("no-data");
    expect(screen.getByTestId("viz-name")).toHaveTextContent("Line Chart Visualization");
  });
});
