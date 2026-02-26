import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import type { ExperimentVisualization } from "@repo/api";

import ExperimentVisualizationRenderer from "./experiment-visualization-renderer";

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

// Mock Next.js dynamic import
vi.mock("next/dynamic", () => ({
  default:
    () =>
    ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock chart renderers
vi.mock("./chart-renderers/basic/line-chart/line-chart-renderer", () => ({
  LineChartRenderer: ({ visualization }: { visualization: { name: string } }) => (
    <div data-testid="line-chart-renderer">Line Chart: {visualization.name}</div>
  ),
}));

vi.mock("./chart-renderers/basic/scatter-chart/scatter-chart-renderer", () => ({
  ScatterChartRenderer: ({ visualization }: { visualization: { name: string } }) => (
    <div data-testid="scatter-chart-renderer">Scatter Chart: {visualization.name}</div>
  ),
}));

describe("ExperimentVisualizationRenderer", () => {
  const mockExperimentId = "exp-123";

  const baseVisualization: ExperimentVisualization = {
    id: "viz-1",
    name: "Test Visualization",
    description: "A test visualization",
    experimentId: mockExperimentId,
    chartFamily: "basic",
    chartType: "line",
    config: {},
    dataConfig: {
      tableName: "measurements",
      dataSources: [
        { tableName: "measurements", columnName: "x", role: "x" },
        { tableName: "measurements", columnName: "y", role: "y" },
      ],
    },
    createdBy: "user-1",
    createdByName: "User One",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z",
  };

  it("should render line chart renderer for line chart type", () => {
    const visualization = { ...baseVisualization, chartType: "line" as const };

    render(
      <ExperimentVisualizationRenderer
        visualization={visualization}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.getByTestId("line-chart-renderer")).toBeInTheDocument();
    expect(screen.getByText("Line Chart: Test Visualization")).toBeInTheDocument();
  });

  it("should render scatter chart renderer for scatter chart type", () => {
    const visualization = { ...baseVisualization, chartType: "scatter" as const };

    render(
      <ExperimentVisualizationRenderer
        visualization={visualization}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.getByTestId("scatter-chart-renderer")).toBeInTheDocument();
    expect(screen.getByText("Scatter Chart: Test Visualization")).toBeInTheDocument();
  });

  it("should render error message for unsupported chart type", () => {
    // Create a visualization with unsupported chart type
    const visualization = {
      ...baseVisualization,
      chartType: "unsupported" as "line", // Type assertion to bypass TypeScript
    };

    render(
      <ExperimentVisualizationRenderer
        visualization={visualization}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.getByText("errors.unsupportedChartType")).toBeInTheDocument();

    // Look for the specific div with text-sm class that contains the error message
    const errorMessageDiv = document.querySelector(".text-sm");
    expect(errorMessageDiv).toBeTruthy();
    expect(errorMessageDiv?.textContent).toContain("unsupported");
    expect(errorMessageDiv?.textContent).toContain("errors.chartTypeNotSupported");

    // Verify the error styling is applied - check the outer error container
    const errorContainer = screen
      .getByText("errors.unsupportedChartType")
      .closest(".bg-muted\\/30");
    expect(errorContainer).toHaveClass("bg-muted/30");
    expect(errorContainer).toHaveClass("text-muted-foreground");
  });

  it("should render title when showTitle is true", () => {
    render(
      <ExperimentVisualizationRenderer
        visualization={baseVisualization}
        experimentId={mockExperimentId}
        showTitle={true}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Test Visualization");
  });

  it("should not render title when showTitle is false", () => {
    render(
      <ExperimentVisualizationRenderer
        visualization={baseVisualization}
        experimentId={mockExperimentId}
        showTitle={false}
      />,
    );

    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("should render description when showDescription is true and description exists", () => {
    render(
      <ExperimentVisualizationRenderer
        visualization={baseVisualization}
        experimentId={mockExperimentId}
        showDescription={true}
      />,
    );

    expect(screen.getByText("A test visualization")).toBeInTheDocument();
  });

  it("should not render description when showDescription is false", () => {
    render(
      <ExperimentVisualizationRenderer
        visualization={baseVisualization}
        experimentId={mockExperimentId}
        showDescription={false}
      />,
    );

    expect(screen.queryByText("A test visualization")).not.toBeInTheDocument();
  });

  it("should not render description when description is null", () => {
    const visualizationWithoutDescription = { ...baseVisualization, description: null };

    render(
      <ExperimentVisualizationRenderer
        visualization={visualizationWithoutDescription}
        experimentId={mockExperimentId}
        showDescription={true}
      />,
    );

    expect(screen.queryByText("A test visualization")).not.toBeInTheDocument();
  });

  it("should render both title and description by default", () => {
    render(
      <ExperimentVisualizationRenderer
        visualization={baseVisualization}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Test Visualization");
    expect(screen.getByText("A test visualization")).toBeInTheDocument();
  });

  it("should pass data to chart renderer", () => {
    const mockData = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ];

    render(
      <ExperimentVisualizationRenderer
        visualization={baseVisualization}
        experimentId={mockExperimentId}
        data={mockData}
      />,
    );

    // The chart renderer should be called with the data
    expect(screen.getByTestId("line-chart-renderer")).toBeInTheDocument();
  });

  it("should handle null data", () => {
    render(
      <ExperimentVisualizationRenderer
        visualization={baseVisualization}
        experimentId={mockExperimentId}
        data={null}
      />,
    );

    expect(screen.getByTestId("line-chart-renderer")).toBeInTheDocument();
  });
});
