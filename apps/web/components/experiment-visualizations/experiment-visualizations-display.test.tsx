import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ExperimentVisualization } from "@repo/api";

import ExperimentVisualizationsDisplay from "./experiment-visualizations-display";

// Mock the visualization renderer component
vi.mock("./experiment-visualization-renderer", () => ({
  default: vi.fn(({ visualization }: { visualization?: ExperimentVisualization }) => (
    <div data-testid="visualization-renderer">
      <div data-testid="viz-id">{visualization?.id}</div>
      <div data-testid="viz-name">{visualization?.name}</div>
    </div>
  )),
}));

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

describe("ExperimentVisualizationsDisplay", () => {
  const mockExperimentId = "exp-123";
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

  it("should render visualization renderer when visualization is selected", () => {
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
  });

  it("should render the visualization renderer for selected visualization", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    // Should render the visualization renderer
    expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("viz-name")).toHaveTextContent("Line Chart Visualization");
  });

  it("should still render renderer when no data is available yet", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId={mockExperimentId}
        visualizations={mockVisualizations}
        isLoading={false}
      />,
    );

    // Should still render the visualization renderer (data fetching is now handled by chart renderers)
    expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("viz-name")).toHaveTextContent("Line Chart Visualization");
  });
});
