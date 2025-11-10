import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { notFound } from "next/navigation";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ExperimentDataPage from "./page";

globalThis.React = React;

// Mock React.use
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    use: vi.fn(() => ({ id: "exp-123", locale: "en-US" })),
  };
});

// --- Mocks ---
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

const mockUseExperiment = vi.fn();
vi.mock("@/hooks/experiment/useExperiment/useExperiment", () => ({
  useExperiment: (): unknown => mockUseExperiment(),
}));

const mockUseLocale = vi.fn();
vi.mock("~/hooks/useLocale", () => ({
  useLocale: (): unknown => mockUseLocale(),
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

vi.mock("~/components/experiment-data/data-upload-modal/data-upload-modal", () => ({
  DataUploadModal: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="data-upload-modal" data-open={open}>
      <button onClick={() => onOpenChange(false)}>Close Modal</button>
    </div>
  ),
}));

vi.mock("~/components/experiment-data/experiment-data-sample-tables", () => ({
  ExperimentDataSampleTables: ({ experimentId }: { experimentId: string }) => (
    <div data-testid="experiment-data-sample-tables" data-experiment-id={experimentId}>
      Sample Tables
    </div>
  ),
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

// --- Tests ---
describe("ExperimentDataPage", () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseExperiment.mockReturnValue(mockExperimentData);
    mockUseLocale.mockReturnValue("en-US");
    mockUseTranslation.mockReturnValue({
      t: (key: string) => key,
    });
  });

  it("renders the experiment data page with all components when loaded", async () => {
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.title")).toBeInTheDocument();
      expect(screen.getByText("experimentData.description")).toBeInTheDocument();
      expect(screen.getByTestId("button")).toBeInTheDocument();
      expect(screen.getByTestId("experiment-data-sample-tables")).toBeInTheDocument();
    });
  });

  it("displays loading state", async () => {
    mockUseExperiment.mockReturnValue({
      ...mockExperimentData,
      isLoading: true,
      data: null,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("loading")).toBeInTheDocument();
    });
  });

  it("displays error state", async () => {
    const error = new Error("Test error");
    mockUseExperiment.mockReturnValue({
      ...mockExperimentData,
      isLoading: false,
      data: null,
      error,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toHaveTextContent(
        "failedToLoad: Error: Test error",
      );
    });
  });

  it("displays not found message when no data", async () => {
    mockUseExperiment.mockReturnValue({
      ...mockExperimentData,
      data: null,
      isLoading: false,
      error: null,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("notFound")).toBeInTheDocument();
    });
  });

  it("calls notFound when experiment is archived", async () => {
    mockUseExperiment.mockReturnValue({
      ...mockExperimentData,
      data: {
        body: {
          ...mockExperimentData.data.body,
          status: "archived",
        },
      },
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });

  it("passes correct experiment ID to components", async () => {
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const samplesTable = screen.getByTestId("experiment-data-sample-tables");
      expect(samplesTable).toHaveAttribute("data-experiment-id", "exp-123");
    });
  });

  it("renders upload button with correct styling", async () => {
    const { container } = render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const button = screen.getByTestId("button");
      expect(button).toHaveTextContent("experimentData.uploadData");

      const uploadIcon = container.querySelector("svg");
      expect(uploadIcon).toBeInTheDocument();
    });
  });

  it("renders with correct structure and spacing", async () => {
    const { container } = render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const mainDiv = container.querySelector(".space-y-8");
      expect(mainDiv).toBeInTheDocument();

      const headerDiv = container.querySelector(".flex.items-start.justify-between");
      expect(headerDiv).toBeInTheDocument();
    });
  });

  it("renders title and description with correct styling", async () => {
    const { container } = render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const title = container.querySelector("h4");
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("text-lg", "font-medium");

      const description = container.querySelector("p");
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass("text-muted-foreground", "text-sm");
    });
  });
});
