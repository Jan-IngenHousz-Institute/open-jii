import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VisualizationsPage from "./page";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "exp-123" }),
  useRouter: () => ({ push: mockPush }),
}));

// Mock hooks
const mockUseExperimentVisualizations = vi.fn();
vi.mock("@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations", () => ({
  useExperimentVisualizations: (params: { experimentId: string; initialChartFamily: undefined }) =>
    mockUseExperimentVisualizations(params) as { data: unknown; isLoading: boolean },
}));

vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

// Mock components
vi.mock("~/components/experiment-visualizations/experiment-visualizations-list", () => ({
  default: ({
    experimentId,
    visualizations,
    isLoading,
  }: {
    experimentId: string;
    visualizations: { id: string; name: string }[];
    isLoading: boolean;
  }) => (
    <div data-testid="visualizations-list" data-loading={isLoading}>
      <div>Experiment: {experimentId}</div>
      {visualizations.map((viz) => (
        <div key={viz.id} data-testid={`viz-${viz.id}`}>
          {viz.name}
        </div>
      ))}
    </div>
  ),
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "ui.title": "Visualizations",
        "ui.actions.create": "Create New Visualization",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock Button component
vi.mock("@repo/ui/components", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  PlusCircle: ({ className }: { className?: string }) => (
    <span className={className}>PlusCircle Icon</span>
  ),
}));

describe("VisualizationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Successful loading state", () => {
    it("should render visualizations list", () => {
      const mockVisualizations = [
        { id: "viz-1", name: "Temperature Over Time" },
        { id: "viz-2", name: "Humidity Analysis" },
      ];

      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: mockVisualizations },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByText("Experiment: exp-123")).toBeInTheDocument();
      expect(screen.getByTestId("viz-viz-1")).toBeInTheDocument();
      expect(screen.getByText("Temperature Over Time")).toBeInTheDocument();
      expect(screen.getByTestId("viz-viz-2")).toBeInTheDocument();
      expect(screen.getByText("Humidity Analysis")).toBeInTheDocument();
    });

    it("should render page title", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByText("Visualizations")).toBeInTheDocument();
    });

    it("should render create button with correct text", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByText("Create New Visualization")).toBeInTheDocument();
    });

    it("should render create button with PlusCircle icon", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByText("PlusCircle Icon")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should navigate to new visualization page when create button is clicked", async () => {
      const user = userEvent.setup();

      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      const createButton = screen.getByRole("button");
      await user.click(createButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/en/platform/experiments/exp-123/analysis/visualizations/new",
        );
      });
    });

    it("should construct correct URL path for new visualization", async () => {
      const user = userEvent.setup();

      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      const createButton = screen.getByRole("button");
      await user.click(createButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1);
        const calledPath = mockPush.mock.calls[0]?.[0] as string;
        expect(calledPath).toContain("exp-123");
        expect(calledPath).toContain("analysis/visualizations/new");
      });
    });
  });

  describe("Empty state", () => {
    it("should render with no visualizations", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByTestId("visualizations-list")).toBeInTheDocument();
      expect(screen.queryByTestId(/^viz-/)).not.toBeInTheDocument();
    });

    it("should still show create button when no visualizations exist", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByText("Create New Visualization")).toBeInTheDocument();
    });

    it("should handle undefined data", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByTestId("visualizations-list")).toBeInTheDocument();
      expect(screen.queryByTestId(/^viz-/)).not.toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("should pass loading state to list component", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: true,
      });

      render(<VisualizationsPage />);

      const list = screen.getByTestId("visualizations-list");
      expect(list.getAttribute("data-loading")).toBe("true");
    });

    it("should render with loading state and no data", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<VisualizationsPage />);

      expect(screen.getByTestId("visualizations-list")).toBeInTheDocument();
    });
  });

  describe("Multiple visualizations", () => {
    it("should render many visualizations", () => {
      const mockVisualizations = Array.from({ length: 10 }, (_, i) => ({
        id: `viz-${i}`,
        name: `Visualization ${i}`,
      }));

      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: mockVisualizations },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      mockVisualizations.forEach((viz) => {
        expect(screen.getByTestId(`viz-${viz.id}`)).toBeInTheDocument();
        expect(screen.getByText(viz.name)).toBeInTheDocument();
      });
    });

    it("should maintain create button with existing visualizations", () => {
      const mockVisualizations = [
        { id: "viz-1", name: "Chart 1" },
        { id: "viz-2", name: "Chart 2" },
      ];

      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: mockVisualizations },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByText("Create New Visualization")).toBeInTheDocument();
    });
  });

  describe("Component integration", () => {
    it("should pass correct experiment ID to list component", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByText("Experiment: exp-123")).toBeInTheDocument();
    });

    it("should call useExperimentVisualizations with correct parameters", () => {
      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: [] },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(mockUseExperimentVisualizations).toHaveBeenCalledWith({
        experimentId: "exp-123",
        initialChartFamily: undefined,
      });
    });

    it("should pass visualizations from data.body to list", () => {
      const mockVisualizations = [
        { id: "viz-1", name: "Chart 1" },
        { id: "viz-2", name: "Chart 2" },
      ];

      mockUseExperimentVisualizations.mockReturnValue({
        data: { body: mockVisualizations },
        isLoading: false,
      });

      render(<VisualizationsPage />);

      expect(screen.getByTestId("viz-viz-1")).toBeInTheDocument();
      expect(screen.getByTestId("viz-viz-2")).toBeInTheDocument();
    });
  });
});
