import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditVisualizationPage from "./page";

// Mock next/navigation
const mockPush = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error("Not Found");
});
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "exp-123", visualizationId: "viz-456" }),
  useRouter: () => ({ push: mockPush }),
  notFound: () => mockNotFound(),
}));

// Mock hooks
const mockUseExperimentVisualization = vi.fn();
const mockUseExperimentSampleData = vi.fn();

vi.mock("@/hooks/experiment/useExperimentVisualization/useExperimentVisualization", () => ({
  useExperimentVisualization: (vizId: string, expId: string) =>
    mockUseExperimentVisualization(vizId, expId) as {
      data: unknown;
      isLoading: boolean;
      error: unknown;
    },
}));

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
vi.mock("@/components/experiment-visualizations/edit-visualization-form", () => ({
  default: ({
    experimentId,
    visualization,
    sampleTables,
    onSuccess,
    isLoading,
    isPreviewOpen,
    onPreviewClose,
  }: {
    experimentId: string;
    visualization: { id: string; name: string };
    sampleTables: unknown[];
    onSuccess: (id: string) => void;
    isLoading: boolean;
    isPreviewOpen: boolean;
    onPreviewClose: () => void;
  }) => (
    <div data-testid="edit-visualization-form" data-loading={isLoading}>
      <div>Experiment: {experimentId}</div>
      <div>Visualization: {visualization.name}</div>
      <div>Tables: {sampleTables.length}</div>
      <div>Preview Open: {isPreviewOpen ? "Yes" : "No"}</div>
      <button onClick={() => onSuccess("viz-456")}>Save Changes</button>
      <button onClick={onPreviewClose}>Close Preview</button>
    </div>
  ),
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "ui.actions.edit": "Edit Visualization",
        "preview.title": "Preview",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock UI components
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
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Eye: ({ className }: { className?: string }) => <span className={className}>Eye Icon</span>,
  Loader2: ({ className }: { className?: string }) => (
    <span className={className}>Loading Spinner</span>
  ),
}));

describe("EditVisualizationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading state", () => {
    it("should show loading spinner when visualization is loading", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      expect(screen.getByText("Edit Visualization")).toBeInTheDocument();
      expect(screen.getByText("Loading Spinner")).toBeInTheDocument();
    });

    it("should show loading spinner when sample data is loading", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: true,
      });

      render(<EditVisualizationPage />);

      expect(screen.getByText("Loading Spinner")).toBeInTheDocument();
    });

    it("should show loading spinner when both are loading", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: true,
      });

      render(<EditVisualizationPage />);

      expect(screen.getByText("Loading Spinner")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("should call notFound when visualization has error", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Failed to load"),
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      // The component calls notFound which throws, so we expect it to have been called
      expect(() => render(<EditVisualizationPage />)).toThrow();
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("should call notFound when visualization data is missing", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      expect(() => render(<EditVisualizationPage />)).toThrow();
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("should call notFound when body is undefined", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: { body: undefined },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      expect(() => render(<EditVisualizationPage />)).toThrow();
      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  describe("Successful rendering", () => {
    it("should render page title", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      expect(screen.getByText("Edit Visualization")).toBeInTheDocument();
    });

    it("should render preview button", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      expect(screen.getByText("Preview")).toBeInTheDocument();
      expect(screen.getByText("Eye Icon")).toBeInTheDocument();
    });

    it("should render form with correct data", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Temperature Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [{ name: "table1" }],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      expect(screen.getByText("Experiment: exp-123")).toBeInTheDocument();
      expect(screen.getByText("Visualization: Temperature Chart")).toBeInTheDocument();
      expect(screen.getByText("Tables: 1")).toBeInTheDocument();
    });

    it("should pass sample tables to form", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      const mockTables = [{ name: "table1" }, { name: "table2" }, { name: "table3" }];
      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: mockTables,
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      expect(screen.getByText("Tables: 3")).toBeInTheDocument();
    });
  });

  describe("Preview functionality", () => {
    it("should initially have preview closed", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      expect(screen.getByText("Preview Open: No")).toBeInTheDocument();
    });

    it("should open preview when button is clicked", async () => {
      const user = userEvent.setup();

      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      const previewButton = screen.getByText("Preview").closest("button");
      if (!previewButton) return;

      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText("Preview Open: Yes")).toBeInTheDocument();
      });
    });

    it("should close preview when onPreviewClose is called", async () => {
      const user = userEvent.setup();

      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

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

      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      const saveButton = screen.getByText("Save Changes");
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/en/platform/experiments/exp-123/analysis/visualizations/viz-456",
        );
      });
    });

    it("should construct correct URL path", async () => {
      const user = userEvent.setup();

      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      const saveButton = screen.getByText("Save Changes");
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1);
        const calledPath = mockPush.mock.calls[0]?.[0] as string;
        expect(calledPath).toContain("exp-123");
        expect(calledPath).toContain("analysis/visualizations");
        expect(calledPath).toContain("viz-456");
      });
    });
  });

  describe("Hook integration", () => {
    it("should call useExperimentVisualization with correct parameters", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      expect(mockUseExperimentVisualization).toHaveBeenCalledWith("viz-456", "exp-123");
    });

    it("should call useExperimentSampleData with correct parameters", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      expect(mockUseExperimentSampleData).toHaveBeenCalledWith("exp-123", 5);
    });
  });

  describe("Button styling", () => {
    it("should have correct preview button styling", () => {
      mockUseExperimentVisualization.mockReturnValue({
        data: { body: { id: "viz-456", name: "Test Chart" } },
        isLoading: false,
        error: null,
      });

      mockUseExperimentSampleData.mockReturnValue({
        sampleTables: [],
        isLoading: false,
      });

      render(<EditVisualizationPage />);

      const previewButton = screen.getByText("Preview").closest("button");
      expect(previewButton?.getAttribute("data-variant")).toBe("outline");
      expect(previewButton?.getAttribute("data-size")).toBe("sm");
    });
  });
});
