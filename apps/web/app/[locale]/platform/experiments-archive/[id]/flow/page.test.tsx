import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentFlow } from "@/hooks/experiment/useExperimentFlow/useExperimentFlow";
import { useExperimentFlowCreate } from "@/hooks/experiment/useExperimentFlowCreate/useExperimentFlowCreate";
import { useExperimentFlowUpdate } from "@/hooks/experiment/useExperimentFlowUpdate/useExperimentFlowUpdate";
import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { useEffect, useImperativeHandle, forwardRef, use } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ExperimentFlowPage from "./page";

// Mocks for hooks used by the page
vi.mock("@/hooks/experiment/useExperiment/useExperiment", () => ({
  useExperiment: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentAccess/useExperimentAccess", () => ({
  useExperimentAccess: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentFlow/useExperimentFlow", () => ({
  useExperimentFlow: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentFlowCreate/useExperimentFlowCreate", () => ({
  useExperimentFlowCreate: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentFlowUpdate/useExperimentFlowUpdate", () => ({
  useExperimentFlowUpdate: vi.fn(),
}));

// Mock translation hook (client)
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock FlowEditor
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

    // Expose the imperative handle
    useImperativeHandle(ref, () => ({
      getFlowData: mockGetFlowData,
    }));

    // Call onDirtyChange to simulate user interaction
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(use).mockReturnValue({ id: "test-experiment-id" });
  mockGetFlowData.mockReturnValue({ nodes: [{ id: "n1" }] });

  vi.spyOn(console, "error").mockImplementation(() => {
    /* no-op */
  });

  // Default safe returns for mutations
  vi.mocked(useExperimentFlowCreate).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useExperimentFlowCreate>);
  vi.mocked(useExperimentFlowUpdate).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useExperimentFlowUpdate>);
  vi.mocked(useExperimentFlow).mockReturnValue({
    data: undefined,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useExperimentFlow>);
});

describe("<ExperimentFlowPage />", () => {
  it("shows loading when experiment or access is loading", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperimentAccess>);

    render(
      <ExperimentFlowPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders ErrorDisplay when there is an error loading", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
    } as unknown as ReturnType<typeof useExperiment>);
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperimentAccess>);

    render(
      <ExperimentFlowPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    // Real ErrorDisplay renders a heading and the error message
    expect(screen.getByText("failedToLoad")).toBeInTheDocument();
    expect(screen.getByText("fail")).toBeInTheDocument();
  });

  it("shows notFound text when experiment data or access experiment is missing", () => {
    // No experiment body
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: { body: { experiment: true } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperimentAccess>);

    render(
      <ExperimentFlowPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  it("calls notFound when experiment is not archived", () => {
    // Provide experiment with non-archived status
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "active" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: { body: { experiment: {} } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperimentAccess>);

    // Make notFound throw so render will surface it
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("notFound");
    });

    expect(() =>
      render(
        <ExperimentFlowPage
          params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
        />,
      ),
    ).toThrow("notFound");
  });
});
