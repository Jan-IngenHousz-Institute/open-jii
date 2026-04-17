import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api";

import ExperimentVisualizationsPage from "./page";

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
  it("renders page title without create button", async () => {
    server.mount(contract.experiments.listExperimentVisualizations, {
      body: [],
    });

    render(<ExperimentVisualizationsPage />);

    await waitFor(() => {
      expect(screen.getByText("ui.title")).toBeInTheDocument();
    });
    expect(screen.queryByText("ui.actions.create")).not.toBeInTheDocument();
  });

  it("passes correct props to visualizations list", async () => {
    const mockVisualizations = [
      createVisualization({
        id: "viz-1",
        name: "Visualization 1",
        experimentId: "test-experiment-id",
      }),
      createVisualization({
        id: "viz-2",
        name: "Visualization 2",
        experimentId: "test-experiment-id",
      }),
    ];

    server.mount(contract.experiments.listExperimentVisualizations, {
      body: mockVisualizations,
    });

    render(<ExperimentVisualizationsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("2");
    });
    expect(screen.getByTestId("visualizations-list")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-id")).toHaveTextContent("test-experiment-id");
  });

  it("shows loading state while fetching", () => {
    server.mount(contract.experiments.listExperimentVisualizations, { delay: "infinite" });

    render(<ExperimentVisualizationsPage />);

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
  });

  it("handles empty visualizations data", async () => {
    server.mount(contract.experiments.listExperimentVisualizations, {
      body: [],
    });

    render(<ExperimentVisualizationsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("0");
    });
  });
});
