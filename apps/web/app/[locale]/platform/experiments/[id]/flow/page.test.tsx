import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React, { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ExperimentFlowPage from "./page";

globalThis.React = React;

// --- Mocks ---
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    const error = new Error("NEXT_NOT_FOUND");
    error.name = "NotFoundError";
    throw error;
  }),
}));

const mockUseExperiment = vi.fn();
vi.mock("@/hooks/experiment/useExperiment/useExperiment", () => ({
  useExperiment: (): unknown => mockUseExperiment(),
}));

const mockUseExperimentAccess = vi.fn();
vi.mock("@/hooks/experiment/useExperimentAccess/useExperimentAccess", () => ({
  useExperimentAccess: (): unknown => mockUseExperimentAccess(),
}));

const mockUseExperimentFlow = vi.fn();
vi.mock("@/hooks/experiment/useExperimentFlow/useExperimentFlow", () => ({
  useExperimentFlow: (): unknown => mockUseExperimentFlow(),
}));

const mockUseExperimentFlowCreate = vi.fn();
vi.mock("@/hooks/experiment/useExperimentFlowCreate/useExperimentFlowCreate", () => ({
  useExperimentFlowCreate: (): unknown => mockUseExperimentFlowCreate(),
}));

const mockUseExperimentFlowUpdate = vi.fn();
vi.mock("@/hooks/experiment/useExperimentFlowUpdate/useExperimentFlowUpdate", () => ({
  useExperimentFlowUpdate: (): unknown => mockUseExperimentFlowUpdate(),
}));

const mockUseTranslation = vi.fn();
vi.mock("@repo/i18n/client", () => ({
  useTranslation: (): unknown => mockUseTranslation(),
}));

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: unknown; title: string }) => (
    <div data-testid="error-display">
      {title}: {String(error)}
    </div>
  ),
}));

vi.mock("@/components/flow-editor", () => ({
  FlowEditor: React.forwardRef<
    HTMLDivElement,
    { initialFlow?: unknown; isDisabled?: boolean; onDirtyChange?: () => void }
  >(({ initialFlow, isDisabled }, ref) => (
    <div
      data-testid="flow-editor"
      data-initial-flow={initialFlow ? "present" : "null"}
      data-disabled={isDisabled ? "true" : "false"}
      ref={ref}
    >
      Flow Editor
    </div>
  )),
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button data-testid="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

// --- Tests ---
describe("ExperimentFlowPage", () => {
  const locale = "en-US";
  const experimentId = "exp-123";
  const defaultProps = {
    params: Promise.resolve({ locale, id: experimentId }),
  };

  const mockExperimentData = {
    data: {
      body: {
        id: "exp-123",
        name: "Test Experiment",
        status: "active",
      },
    },
    isLoading: false,
    error: null,
  };

  const mockAccessData = {
    data: {
      body: {
        hasAccess: true,
        isAdmin: true,
        experiment: {
          id: "exp-123",
          name: "Test Experiment",
        },
      },
    },
    isLoading: false,
    error: null,
  };

  const mockFlowData = {
    data: null,
    refetch: vi.fn(),
  };

  const mockCreateMutation = {
    mutate: vi.fn(),
  };

  const mockUpdateMutation = {
    mutate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: "exp-123", locale: "en-US" } as never);
    mockUseExperiment.mockReturnValue(mockExperimentData);
    mockUseExperimentAccess.mockReturnValue(mockAccessData);
    mockUseExperimentFlow.mockReturnValue(mockFlowData);
    mockUseExperimentFlowCreate.mockReturnValue(mockCreateMutation);
    mockUseExperimentFlowUpdate.mockReturnValue(mockUpdateMutation);
    mockUseTranslation.mockReturnValue({
      t: (key: string) => key,
    });
  });

  it("renders the experiment flow page with all components when loaded", async () => {
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("flow.title")).toBeInTheDocument();
      expect(screen.getByTestId("flow-editor")).toBeInTheDocument();
      expect(screen.getByTestId("button")).toBeInTheDocument();
    });
  });

  it("displays loading state when experiment is loading", async () => {
    mockUseExperiment.mockReturnValue({
      ...mockExperimentData,
      isLoading: true,
      data: null,
    });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("loading")).toBeInTheDocument();
    });
  });

  it("displays error state when experiment fails to load", async () => {
    const error = new Error("Test error");
    mockUseExperiment.mockReturnValue({
      ...mockExperimentData,
      isLoading: false,
      data: null,
      error,
    });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toHaveTextContent(
        "failedToLoad: Error: Test error",
      );
    });
  });

  it("calls notFound when experiment is archived", () => {
    mockUseExperiment.mockReturnValue({
      ...mockExperimentData,
      data: {
        body: {
          ...mockExperimentData.data.body,
          status: "archived",
        },
      },
    });

    expect(() => render(<ExperimentFlowPage params={defaultProps.params} />)).toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("renders FlowEditor with correct props", async () => {
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      const flowEditor = screen.getByTestId("flow-editor");
      expect(flowEditor).toHaveAttribute("data-disabled", "false");
      expect(flowEditor).toHaveAttribute("data-initial-flow", "null");
    });
  });

  it("displays access loading state", async () => {
    mockUseExperimentAccess.mockReturnValue({
      ...mockAccessData,
      isLoading: true,
      data: null,
    });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("loading")).toBeInTheDocument();
    });
  });

  it("displays access error state", async () => {
    const error = new Error("Access error");
    mockUseExperimentAccess.mockReturnValue({
      ...mockAccessData,
      isLoading: false,
      data: null,
      error,
    });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });
  });

  it("renders save button with correct text", async () => {
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("button")).toHaveTextContent("flow.saveFlow");
    });
  });

  it("renders with correct structure and spacing", async () => {
    const { container } = render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      const mainDiv = container.querySelector(".space-y-6");
      expect(mainDiv).toBeInTheDocument();

      const headerDiv = container.querySelector(".flex.items-center.justify-between");
      expect(headerDiv).toBeInTheDocument();
    });
  });

  it("renders title with correct styling", async () => {
    const { container } = render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      const title = container.querySelector("h2");
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("text-2xl", "font-bold");
      expect(title).toHaveTextContent("flow.title");
    });
  });
});
