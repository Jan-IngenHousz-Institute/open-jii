/* eslint-disable @typescript-eslint/no-unsafe-return */
import { render, screen } from "@/test/test-utils";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import DataLayout from "../layout";

// -------------------
// Mocks
// -------------------

// Mock React's use function for async params

// Mock useExperiment hook
const mockUseExperiment = vi.fn();
vi.mock("@/hooks/experiment/useExperiment/useExperiment", () => ({
  useExperiment: (id: string) => mockUseExperiment(id),
}));

// Mock i18n
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock error display component
vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: Error; title: string }) => (
    <div data-testid="error-display">
      <h2>{title}</h2>
      <p>{error.message}</p>
    </div>
  ),
}));

// -------------------
// Test Data
// -------------------
const mockParams = { id: "test-experiment-id", locale: "en-US" };

const createMockExperiment = (status: string) => ({
  data: {
    body: {
      id: "test-experiment-id",
      name: "Test Experiment",
      status,
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
  },
  isLoading: false,
  error: null,
});

// -------------------
// Helpers
// -------------------
function renderDataLayout({
  children = <div data-testid="child-content">Child Content</div>,
  experimentStatus = "active",
  isLoading = false,
  error = null,
}: {
  children?: React.ReactNode;
  experimentStatus?: string;
  isLoading?: boolean;
  error?: Error | null;
} = {}) {
  // Mock the async params
  vi.mocked(use).mockReturnValue(mockParams);

  // Mock useExperiment hook response
  if (error) {
    mockUseExperiment.mockReturnValue({
      data: null,
      isLoading: false,
      error,
    });
  } else if (isLoading) {
    mockUseExperiment.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });
  } else {
    mockUseExperiment.mockReturnValue(createMockExperiment(experimentStatus));
  }

  return render(<DataLayout params={Promise.resolve(mockParams)}>{children}</DataLayout>);
}

// -------------------
// Tests
// -------------------
describe("<DataLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading message when data is loading", () => {
      renderDataLayout({ isLoading: true });

      expect(screen.getByText("loading")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error display when there is an error", () => {
      const error = new Error("Failed to fetch experiment");
      renderDataLayout({ error });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByText("failedToLoad")).toBeInTheDocument();
      expect(screen.getByText("Failed to fetch experiment")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("No Data State", () => {
    it("shows not found message when no data is returned", () => {
      vi.mocked(use).mockReturnValue(mockParams);
      mockUseExperiment.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      expect(screen.getByText("notFound")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });

    it("shows not found message when experiment body is missing", () => {
      vi.mocked(use).mockReturnValue(mockParams);
      mockUseExperiment.mockReturnValue({
        data: { body: null },
        isLoading: false,
        error: null,
      });

      render(
        <DataLayout params={Promise.resolve(mockParams)}>
          <div data-testid="child-content">Child Content</div>
        </DataLayout>,
      );

      expect(screen.getByText("notFound")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("Active State", () => {
    it("renders children when experiment status is active", () => {
      renderDataLayout({ experimentStatus: "active" });

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders children when experiment status is completed", () => {
      renderDataLayout({ experimentStatus: "completed" });

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("renders children when experiment status is unknown", () => {
      renderDataLayout({ experimentStatus: "unknown" });

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });
  });

  describe("Hook Integration", () => {
    it("calls useExperiment with correct experiment ID", () => {
      renderDataLayout();

      expect(mockUseExperiment).toHaveBeenCalledWith("test-experiment-id");
    });

    it("calls use function with params promise", () => {
      renderDataLayout();

      expect(vi.mocked(use)).toHaveBeenCalledWith(expect.any(Promise));
    });
  });
});
