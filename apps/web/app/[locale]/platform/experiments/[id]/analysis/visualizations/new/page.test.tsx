import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewVisualizationPage from "./page";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "exp-123" }),
  useRouter: () => ({ push: mockPush }),
}));

// Mock hooks
const mockUseExperimentSampleData = vi.fn();
vi.mock("@/hooks/experiment/useExperimentData/useExperimentData", () => ({
  useExperimentSampleData: (experimentId: string, limit: number) =>
    mockUseExperimentSampleData(experimentId, limit) as {
      sampleTables: unknown[];
      isLoading: boolean;
    },
}));

vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

// Mock components
vi.mock("@/components/experiment-visualizations/new-visualization-form", () => ({
  default: ({
    experimentId,
    sampleTables,
    onSuccess,
    isLoading,
    isPreviewOpen,
    onPreviewClose,
  }: {
    experimentId: string;
    sampleTables: unknown[];
    onSuccess: (id: string) => void;
    isLoading: boolean;
    isPreviewOpen: boolean;
    onPreviewClose: () => void;
  }) => (
    <div data-testid="new-visualization-form" data-loading={isLoading}>
      <div>Experiment: {experimentId}</div>
      <div>Tables: {sampleTables.length}</div>
      <div>Preview Open: {isPreviewOpen ? "Yes" : "No"}</div>
      <button onClick={() => onSuccess("new-viz-123")}>Create Visualization</button>
      <button onClick={onPreviewClose}>Close Preview</button>
    </div>
  ),
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "ui.actions.create": "Create New Visualization",
        "preview.title": "Preview",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock Button component
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button onClick={onClick} data-variant={variant} data-size={size} className={className}>
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Eye: ({ className }: { className?: string }) => <span className={className}>Eye Icon</span>,
}));

describe("NewVisualizationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render page title", () => {
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      expect(screen.getByText("Create New Visualization")).toBeInTheDocument();
    });

    it("should render preview button", () => {
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      expect(screen.getByText("Preview")).toBeInTheDocument();
      expect(screen.getByText("Eye Icon")).toBeInTheDocument();
    });

    it("should render form with correct experiment ID", () => {
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      expect(screen.getByText("Experiment: exp-123")).toBeInTheDocument();
    });

    it("should pass sample tables to form", () => {
      const mockTables = [{ name: "table1" }, { name: "table2" }, { name: "table3" }];

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: mockTables,
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      expect(screen.getByText("Tables: 3")).toBeInTheDocument();
    });

    it("should pass loading state to form", () => {
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: true,
      });

      render(<NewVisualizationPage />);

      const form = screen.getByTestId("new-visualization-form");
      expect(form.getAttribute("data-loading")).toBe("true");
    });
  });

  describe("Preview functionality", () => {
    it("should initially have preview closed", () => {
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      expect(screen.getByText("Preview Open: No")).toBeInTheDocument();
    });

    it("should open preview when button is clicked", async () => {
      const user = userEvent.setup();

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      const previewButton = screen.getByText("Preview").closest("button");
      expect(previewButton).toBeTruthy();
      if (!previewButton) return;

      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: Yes")).toBeInTheDocument();
      });
    });

    it("should close preview when onPreviewClose is called", async () => {
      const user = userEvent.setup();

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      // Open preview
      const previewButton = screen.getByText("Preview").closest("button");
      if (!previewButton) return;

      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: Yes")).toBeInTheDocument();
      });

      // Close preview
      const closeButton = screen.getByText("Close Preview");
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: No")).toBeInTheDocument();
      });
    });
  });

  describe("Form submission", () => {
    it("should navigate to visualization detail on success", async () => {
      const user = userEvent.setup();

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      const createButton = screen.getByText("Create Visualization");
      await user.click(createButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/en/platform/experiments/exp-123/analysis/visualizations/new-viz-123",
        );
      });
    });

    it("should construct correct URL with visualization ID", async () => {
      const user = userEvent.setup();

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      const createButton = screen.getByText("Create Visualization");
      await user.click(createButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1);
        const calledPath = mockPush.mock.calls[0]?.[0] as string;
        expect(calledPath).toContain("exp-123");
        expect(calledPath).toContain("analysis/visualizations");
        expect(calledPath).toContain("new-viz-123");
      });
    });
  });

  describe("Data fetching", () => {
    it("should fetch sample data with correct parameters", () => {
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      expect(mockUseExperimentSampleData).toHaveBeenCalledWith("exp-123", 5);
    });

    it("should handle loading state", () => {
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: true,
      });

      render(<NewVisualizationPage />);

      const form = screen.getByTestId("new-visualization-form");
      expect(form.getAttribute("data-loading")).toBe("true");
    });

    it("should handle empty sample tables", () => {
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      expect(screen.getByText("Tables: 0")).toBeInTheDocument();
    });

    it("should handle multiple sample tables", () => {
      const mockTables = Array.from({ length: 10 }, (_, i) => ({ name: `table${i}` }));

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: mockTables,
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      expect(screen.getByText("Tables: 10")).toBeInTheDocument();
    });
  });

  describe("Button styling", () => {
    it("should have correct preview button variant", () => {
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<NewVisualizationPage />);

      const previewButton = screen.getByText("Preview").closest("button");
      expect(previewButton?.getAttribute("data-variant")).toBe("outline");
      expect(previewButton?.getAttribute("data-size")).toBe("default");
    });
  });
});
