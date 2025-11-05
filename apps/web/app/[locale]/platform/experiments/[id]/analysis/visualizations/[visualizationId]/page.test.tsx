import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import VisualizationDetailPage from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock the ExperimentVisualizationDetails component
vi.mock(
  "../../../../../../../../components/experiment-visualizations/experiment-visualization-details",
  () => ({
    default: ({
      experimentId,
      visualizationId,
    }: {
      experimentId: string;
      visualizationId: string;
    }) => (
      <div data-testid="visualization-details">
        <div>Experiment ID: {experimentId}</div>
        <div>Visualization ID: {visualizationId}</div>
      </div>
    ),
  }),
);

describe("VisualizationDetailPage", () => {
  it("should render visualization details with correct IDs", async () => {
    const mockParams = Promise.resolve({
      locale: "en",
      id: "exp-123",
      visualizationId: "viz-456",
    });

    const result = await VisualizationDetailPage({ params: mockParams });
    render(result);

    expect(screen.getByTestId("visualization-details")).toBeInTheDocument();
    expect(screen.getByText("Experiment ID: exp-123")).toBeInTheDocument();
    expect(screen.getByText("Visualization ID: viz-456")).toBeInTheDocument();
  });

  it("should call notFound when experiment ID is missing", async () => {
    const mockParams = Promise.resolve({
      locale: "en",
      id: "",
      visualizationId: "viz-456",
    });

    await VisualizationDetailPage({ params: mockParams });

    expect(notFound).toHaveBeenCalled();
  });

  it("should call notFound when visualization ID is missing", async () => {
    const mockParams = Promise.resolve({
      locale: "en",
      id: "exp-123",
      visualizationId: "",
    });

    await VisualizationDetailPage({ params: mockParams });

    expect(notFound).toHaveBeenCalled();
  });

  it("should call notFound when both IDs are missing", async () => {
    const mockParams = Promise.resolve({
      locale: "en",
      id: "",
      visualizationId: "",
    });

    await VisualizationDetailPage({ params: mockParams });

    expect(notFound).toHaveBeenCalled();
  });

  it("should pass correct props to ExperimentVisualizationDetails", async () => {
    const mockParams = Promise.resolve({
      locale: "en",
      id: "test-exp-789",
      visualizationId: "test-viz-999",
    });

    const result = await VisualizationDetailPage({ params: mockParams });
    render(result);

    expect(screen.getByText("Experiment ID: test-exp-789")).toBeInTheDocument();
    expect(screen.getByText("Visualization ID: test-viz-999")).toBeInTheDocument();
  });

  it("should handle different locale values", async () => {
    const mockParams = Promise.resolve({
      locale: "de",
      id: "exp-123",
      visualizationId: "viz-456",
    });

    const result = await VisualizationDetailPage({ params: mockParams });
    render(result);

    // Locale is passed but not used in this component
    expect(screen.getByTestId("visualization-details")).toBeInTheDocument();
  });
});
