import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useExperimentLocations } from "@/hooks/experiment/useExperimentLocations/useExperimentLocations";
import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import React, { useEffect, useImperativeHandle, forwardRef } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ExperimentOverviewPage from "./page";

globalThis.React = React;

// Mock react.use to return a params-like object { id }
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    use: vi.fn().mockReturnValue({ id: "test-experiment-id" }),
  };
});

// Mock hooks used by the page
vi.mock("@/hooks/experiment/useExperiment/useExperiment", () => ({
  useExperiment: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentFlow/useExperimentFlow", () => ({
  useExperimentFlow: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentLocations/useExperimentLocations", () => ({
  useExperimentLocations: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations", () => ({
  useExperimentVisualizations: vi.fn(),
}));

// Mock translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock FlowEditor: Simple test double that renders props for verification
const mockGetFlowData = vi.fn(() => ({ nodes: [{ id: "n1" }] }));

vi.mock("@/components/flow-editor", () => ({
  FlowEditor: forwardRef<
    { getFlowData: () => { nodes: { id: string }[] } },
    {
      initialFlow?: unknown;
      isDisabled?: boolean;
      onDirtyChange?: () => void;
    }
  >((props, ref) => {
    const { onDirtyChange, initialFlow, isDisabled } = props;

    useImperativeHandle(ref, () => ({
      getFlowData: mockGetFlowData,
    }));

    useEffect(() => {
      if (onDirtyChange) {
        onDirtyChange();
      }
    }, [onDirtyChange]);

    return (
      <div data-testid="flow-editor">
        <div data-testid="flow-initial">{initialFlow ? "has-flow" : "no-flow"}</div>
        <div data-testid="flow-disabled">{String(isDisabled)}</div>
      </div>
    );
  }),
}));

// Mock ExperimentVisualizationsDisplay
vi.mock("@/components/experiment-visualizations/experiment-visualizations-display", () => ({
  default: ({
    experimentId,
    visualizations,
    isLoading,
  }: {
    experimentId: string;
    visualizations: unknown[];
    isLoading: boolean;
  }) => (
    <div data-testid="visualizations-display">
      <div data-testid="visualizations-experiment-id">{experimentId}</div>
      <div data-testid="visualizations-loading">{String(isLoading)}</div>
      <div data-testid="visualizations-count">{visualizations.length}</div>
    </div>
  ),
}));

// Mock ExperimentLocationsDisplay
vi.mock("@/components/experiment/experiment-locations-display", () => ({
  ExperimentLocationsDisplay: ({
    locations,
    isLoading,
  }: {
    locations: unknown[];
    isLoading: boolean;
  }) => (
    <div data-testid="locations-display">
      <div data-testid="locations-loading">{String(isLoading)}</div>
      <div data-testid="locations-count">{locations.length}</div>
    </div>
  ),
}));

// Mock next/navigation notFound
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetFlowData.mockReturnValue({ nodes: [{ id: "n1" }] });

  // Default safe returns
  vi.mocked(useExperimentFlow).mockReturnValue({
    data: undefined,
  } as unknown as ReturnType<typeof useExperimentFlow>);
  vi.mocked(useExperimentLocations).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useExperimentLocations>);
  vi.mocked(useExperimentVisualizations).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useExperimentVisualizations>);
});

describe("<ExperimentOverviewPage />", () => {
  it("shows loading when experiment is loading", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders ErrorDisplay when there is an error loading", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
    } as unknown as ReturnType<typeof useExperiment>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    expect(screen.getByText("failedToLoad")).toBeInTheDocument();
    expect(screen.getByText("fail")).toBeInTheDocument();
  });

  it("shows notFound text when experiment data is missing", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  it("shows notFound text when experiment body is missing", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: undefined },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  it("calls notFound when experiment is not archived", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "active", name: "Test", id: "123" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("notFound");
    });

    expect(() =>
      render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />),
    ).toThrow("notFound");
  });

  it("renders experiment overview with all sections when archived", () => {
    const mockExperiment = {
      id: "exp-123",
      name: "Test Experiment",
      status: "archived",
      visibility: "public",
      description: "Test description",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    vi.mocked(useExperiment).mockReturnValue({
      data: { body: mockExperiment },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    vi.mocked(useExperimentLocations).mockReturnValue({
      data: { body: [{ id: "loc-1", name: "Location 1" }] },
      isLoading: false,
    } as unknown as ReturnType<typeof useExperimentLocations>);

    vi.mocked(useExperimentVisualizations).mockReturnValue({
      data: {
        body: [
          { id: "viz-1", name: "Visualization 1" },
          { id: "viz-2", name: "Visualization 2" },
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useExperimentVisualizations>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    // Check experiment name
    expect(screen.getByText("Test Experiment")).toBeInTheDocument();

    // Check status badge
    expect(screen.getByText("status.archived")).toBeInTheDocument();

    // Check visibility badge
    expect(screen.getByText("public")).toBeInTheDocument();

    // Check formatted dates (using real formatDate function)
    expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
    expect(screen.getByText("Jan 2, 2024")).toBeInTheDocument();

    // Check experiment ID
    expect(screen.getByText("exp-123")).toBeInTheDocument();

    // Check description section
    expect(screen.getByText("descriptionTitle")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();

    // Check visualizations display
    expect(screen.getByTestId("visualizations-display")).toBeInTheDocument();
    expect(screen.getByTestId("visualizations-experiment-id")).toHaveTextContent(
      "test-experiment-id",
    );
    expect(screen.getByTestId("visualizations-count")).toHaveTextContent("2");
    expect(screen.getByTestId("visualizations-loading")).toHaveTextContent("false");

    // Check locations display
    expect(screen.getByTestId("locations-display")).toBeInTheDocument();
    expect(screen.getByTestId("locations-count")).toHaveTextContent("1");
  });

  it("renders FlowEditor when flow data exists", () => {
    const mockExperiment = {
      id: "exp-123",
      name: "Test Experiment",
      status: "archived",
      visibility: "public",
      description: "Test description",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    vi.mocked(useExperiment).mockReturnValue({
      data: { body: mockExperiment },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    vi.mocked(useExperimentFlow).mockReturnValue({
      data: { body: { nodes: [{ id: "n1" }] } },
    } as unknown as ReturnType<typeof useExperimentFlow>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    // Flow section should render
    expect(screen.getByText("flow.title")).toBeInTheDocument();
    expect(screen.getByText("flow.staticDescription")).toBeInTheDocument();
    expect(screen.getByText("previewMode")).toBeInTheDocument();

    // FlowEditor should be rendered with correct props
    expect(screen.getByTestId("flow-editor")).toBeInTheDocument();
    expect(screen.getByTestId("flow-initial")).toHaveTextContent("has-flow");
    expect(screen.getByTestId("flow-disabled")).toHaveTextContent("true");
  });

  it("does not render FlowEditor when flow data is missing", () => {
    const mockExperiment = {
      id: "exp-123",
      name: "Test Experiment",
      status: "archived",
      visibility: "public",
      description: "Test description",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    vi.mocked(useExperiment).mockReturnValue({
      data: { body: mockExperiment },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    vi.mocked(useExperimentFlow).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useExperimentFlow>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    // Flow section should not render
    expect(screen.queryByText("flow.title")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flow-editor")).not.toBeInTheDocument();
  });

  it("renders different status badges correctly", () => {
    const statuses = ["active", "provisioning", "archived", "stale"];

    statuses.forEach((status) => {
      const mockExperiment = {
        id: "exp-123",
        name: "Test Experiment",
        status,
        visibility: "public",
        description: "Test description",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      };

      vi.mocked(useExperiment).mockReturnValue({
        data: { body: mockExperiment },
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useExperiment>);

      // Only archived status should render without throwing
      if (status === "archived") {
        const { unmount } = render(
          <ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />,
        );
        expect(screen.getByText(`status.${status}`)).toBeInTheDocument();
        unmount();
      }
    });
  });
});
