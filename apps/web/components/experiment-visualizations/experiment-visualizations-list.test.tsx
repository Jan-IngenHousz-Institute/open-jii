import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ExperimentVisualization } from "@repo/api";

import ExperimentVisualizationsList from "./experiment-visualizations-list";

// Mock the dependencies
vi.mock("@repo/i18n", () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

vi.mock("@/util/date", () => ({
  formatDate: vi.fn((date: string) => new Date(date).toLocaleDateString()),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ExperimentVisualizationsList", () => {
  const mockExperimentId = "exp-123";

  const createMockVisualization = (
    overrides: Partial<ExperimentVisualization> = {},
  ): ExperimentVisualization => ({
    id: "viz-1",
    name: "Test Visualization",
    description: "A test visualization description",
    chartFamily: "basic",
    chartType: "line",
    dataConfig: {
      tableName: "test_table",
      dataSources: [
        { tableName: "test_table", columnName: "x", role: "x" as const },
        { tableName: "test_table", columnName: "y", role: "y" as const },
      ],
    },
    experimentId: mockExperimentId,
    createdBy: "user-123",
    createdByName: "Test User",
    createdAt: new Date("2024-01-01").toISOString(),
    updatedAt: new Date("2024-01-15").toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should render loading state when isLoading is true", () => {
      render(
        <ExperimentVisualizationsList
          visualizations={[]}
          experimentId={mockExperimentId}
          isLoading={true}
        />,
      );

      expect(screen.getByText("loading")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should render empty state when no visualizations", () => {
      render(
        <ExperimentVisualizationsList
          visualizations={[]}
          experimentId={mockExperimentId}
          isLoading={false}
        />,
      );

      expect(screen.getByText("ui.messages.noVisualizations")).toBeInTheDocument();
    });
  });

  describe("Visualizations List", () => {
    it("should render single visualization", () => {
      const visualization = createMockVisualization();

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText("Test Visualization")).toBeInTheDocument();
      expect(screen.getByText("A test visualization description")).toBeInTheDocument();
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("charts.types.line")).toBeInTheDocument();
    });

    it("should render multiple visualizations", () => {
      const visualizations = [
        createMockVisualization({ id: "viz-1", name: "Visualization 1" }),
        createMockVisualization({ id: "viz-2", name: "Visualization 2", chartType: "scatter" }),
        createMockVisualization({ id: "viz-3", name: "Visualization 3" }),
      ];

      render(
        <ExperimentVisualizationsList
          visualizations={visualizations}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText("Visualization 1")).toBeInTheDocument();
      expect(screen.getByText("Visualization 2")).toBeInTheDocument();
      expect(screen.getByText("Visualization 3")).toBeInTheDocument();
    });

    it("should render correct link href for each visualization", () => {
      const visualization = createMockVisualization({ id: "viz-456" });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        `/platform/experiments/${mockExperimentId}/analysis/visualizations/viz-456`,
      );
    });
  });

  describe("Chart Type Display", () => {
    it("should display 'Line Chart' for line chart type", () => {
      const visualization = createMockVisualization({ chartType: "line" });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText("charts.types.line")).toBeInTheDocument();
    });

    it("should display 'Line Chart' for lineplot chart type", () => {
      const visualization = createMockVisualization({ chartType: "lineplot" as "line" });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText("charts.types.line")).toBeInTheDocument();
    });

    it("should display 'Scatter Plot' for scatter chart type", () => {
      const visualization = createMockVisualization({ chartType: "scatter" });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText("charts.types.scatter")).toBeInTheDocument();
    });

    it("should display 'Scatter Plot' for scatterplot chart type", () => {
      const visualization = createMockVisualization({ chartType: "scatterplot" as "scatter" });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText("charts.types.scatter")).toBeInTheDocument();
    });

    it("should display original chart type for unknown types", () => {
      const visualization = createMockVisualization({ chartType: "customChart" as "line" });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText("customChart")).toBeInTheDocument();
    });
  });

  describe("Chart Type Styling", () => {
    it("should apply blue styling for line charts", () => {
      const visualization = createMockVisualization({ chartType: "line" });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      const badge = screen.getByText("charts.types.line");
      expect(badge).toHaveClass("bg-blue-100", "text-blue-800");
    });

    it("should apply green styling for scatter charts", () => {
      const visualization = createMockVisualization({ chartType: "scatter" });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      const badge = screen.getByText("charts.types.scatter");
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("should apply gray styling for unknown chart types", () => {
      const visualization = createMockVisualization({ chartType: "unknown" as "line" });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      const badge = screen.getByText("unknown");
      expect(badge).toHaveClass("bg-gray-100", "text-gray-800");
    });
  });

  describe("User Information", () => {
    it("should display createdByName when available", () => {
      const visualization = createMockVisualization({
        createdByName: "John Doe",
      });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should display truncated user ID when createdByName is not available", () => {
      const visualization = createMockVisualization({
        createdBy: "user-1234567890",
        createdByName: undefined,
      });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText("user-123...")).toBeInTheDocument();
    });
  });

  describe("Date Formatting", () => {
    it("should display formatted update date", () => {
      const visualization = createMockVisualization({
        updatedAt: new Date("2024-03-15").toISOString(),
      });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      const formattedDate = new Date("2024-03-15").toLocaleDateString();
      expect(screen.getByText(`common.updated ${formattedDate}`)).toBeInTheDocument();
    });
  });

  describe("Description Handling", () => {
    it("should display full description when under 120 characters", () => {
      const shortDescription = "This is a short description";
      const visualization = createMockVisualization({
        description: shortDescription,
      });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText(shortDescription)).toBeInTheDocument();
    });

    it("should truncate description when over 120 characters", () => {
      const longDescription =
        "This is a very long description that exceeds the 120 character limit and should be truncated with ellipsis at the end to maintain readability";
      const visualization = createMockVisualization({
        description: longDescription,
      });

      render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      expect(screen.getByText(longDescription.substring(0, 120) + "...")).toBeInTheDocument();
      expect(screen.queryByText(longDescription)).not.toBeInTheDocument();
    });

    it("should not render description section when description is null", () => {
      const visualization = createMockVisualization({
        description: null as unknown as string,
      });

      const { container } = render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      // Check that there's no description text rendered
      const descriptionElement = container.querySelector(".line-clamp-2");
      expect(descriptionElement).not.toBeInTheDocument();
    });

    it("should not render description section when description is empty string", () => {
      const visualization = createMockVisualization({
        description: "",
      });

      const { container } = render(
        <ExperimentVisualizationsList
          visualizations={[visualization]}
          experimentId={mockExperimentId}
        />,
      );

      // Check that there's no description text rendered
      const descriptionElement = container.querySelector(".line-clamp-2");
      expect(descriptionElement).not.toBeInTheDocument();
    });
  });

  describe("View Details Button", () => {
    it("should render view details button for each visualization", () => {
      const visualizations = [
        createMockVisualization({ id: "viz-1" }),
        createMockVisualization({ id: "viz-2" }),
      ];

      render(
        <ExperimentVisualizationsList
          visualizations={visualizations}
          experimentId={mockExperimentId}
        />,
      );

      const buttons = screen.getAllByText("experiments.viewDetails");
      expect(buttons).toHaveLength(2);
    });
  });

  describe("Grid Layout", () => {
    it("should render visualizations in a grid layout", () => {
      const visualizations = [
        createMockVisualization({ id: "viz-1" }),
        createMockVisualization({ id: "viz-2" }),
        createMockVisualization({ id: "viz-3" }),
      ];

      const { container } = render(
        <ExperimentVisualizationsList
          visualizations={visualizations}
          experimentId={mockExperimentId}
        />,
      );

      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toHaveClass("grid-cols-1", "md:grid-cols-2", "lg:grid-cols-3");
    });
  });
});
