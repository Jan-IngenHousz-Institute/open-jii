import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import React from "react";
import { vi, describe, it, expect } from "vitest";

import VisualizationDetailPage from "./page";

globalThis.React = React;

// Mock next/navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock ExperimentVisualizationDetails component
vi.mock(
  "../../../../../../../../components/experiment-visualizations/experiment-visualization-details",
  () => ({
    default: ({
      experimentId,
      visualizationId,
      isArchiveContext,
    }: {
      experimentId: string;
      visualizationId: string;
      isArchiveContext?: boolean;
    }) => (
      <div data-testid="visualization-details">
        <div data-testid="experiment-id">{experimentId}</div>
        <div data-testid="visualization-id">{visualizationId}</div>
        <div data-testid="archive-context">{isArchiveContext ? "true" : "false"}</div>
      </div>
    ),
  }),
);

describe("<VisualizationDetailPage />", () => {
  it("renders visualization details with correct props", async () => {
    const params = Promise.resolve({
      locale: "en-US",
      id: "test-experiment-id",
      visualizationId: "test-visualization-id",
    });

    const result = await VisualizationDetailPage({ params });

    render(result);

    expect(screen.getByTestId("visualization-details")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-id")).toHaveTextContent("test-experiment-id");
    expect(screen.getByTestId("visualization-id")).toHaveTextContent("test-visualization-id");
    expect(screen.getByTestId("archive-context")).toHaveTextContent("true");
  });

  it("calls notFound when experimentId is missing", async () => {
    const params = Promise.resolve({
      locale: "en-US",
      id: "",
      visualizationId: "test-visualization-id",
    });

    await VisualizationDetailPage({ params });

    expect(vi.mocked(notFound)).toHaveBeenCalled();
  });

  it("calls notFound when visualizationId is missing", async () => {
    const params = Promise.resolve({
      locale: "en-US",
      id: "test-experiment-id",
      visualizationId: "",
    });

    await VisualizationDetailPage({ params });

    expect(vi.mocked(notFound)).toHaveBeenCalled();
  });

  it("calls notFound when both ids are missing", async () => {
    const params = Promise.resolve({
      locale: "en-US",
      id: "",
      visualizationId: "",
    });

    await VisualizationDetailPage({ params });

    expect(vi.mocked(notFound)).toHaveBeenCalled();
  });
});
