import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { useParams } from "next/navigation";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ExperimentVisualizationsPage from "./page";

globalThis.React = React;

// Mock hooks
vi.mock("@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations", () => ({
  useExperimentVisualizations: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
}));

// Mock translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock ExperimentVisualizationsList component
vi.mock("~/components/experiment-visualizations/experiment-visualizations-list", () => ({
  default: ({
    visualizations,
    experimentId,
    isLoading,
  }: {
    visualizations: unknown[];
    experimentId: string;
    isLoading: boolean;
  }) => (
    <div data-testid="visualizations-list">
      <div data-testid="experiment-id">{experimentId}</div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="count">{visualizations.length}</div>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useParams).mockReturnValue({ id: "test-experiment-id" });
});

describe("<ExperimentVisualizationsPage />", () => {
  it("renders page title without create button", () => {
    vi.mocked(useExperimentVisualizations).mockReturnValue({
      data: { body: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useExperimentVisualizations>);

    render(<ExperimentVisualizationsPage />);

    expect(screen.getByText("ui.title")).toBeInTheDocument();
    expect(screen.queryByText("ui.actions.create")).not.toBeInTheDocument();
  });

  it("passes correct props to visualizations list", () => {
    const mockVisualizations = [
      { id: "viz-1", name: "Visualization 1" },
      { id: "viz-2", name: "Visualization 2" },
    ];

    vi.mocked(useExperimentVisualizations).mockReturnValue({
      data: { body: mockVisualizations },
      isLoading: true,
    } as unknown as ReturnType<typeof useExperimentVisualizations>);

    render(<ExperimentVisualizationsPage />);

    expect(screen.getByTestId("visualizations-list")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-id")).toHaveTextContent("test-experiment-id");
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("handles empty visualizations data", () => {
    vi.mocked(useExperimentVisualizations).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useExperimentVisualizations>);

    render(<ExperimentVisualizationsPage />);

    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("calls hook with correct parameters", () => {
    vi.mocked(useExperimentVisualizations).mockReturnValue({
      data: { body: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useExperimentVisualizations>);

    render(<ExperimentVisualizationsPage />);

    expect(useExperimentVisualizations).toHaveBeenCalledWith({
      experimentId: "test-experiment-id",
      initialChartFamily: undefined,
    });
  });
});
