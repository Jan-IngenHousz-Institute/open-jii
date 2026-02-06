import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, notFound } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ExperimentVisualization } from "@repo/api";
import { toast } from "@repo/ui/hooks";

import { useExperimentAccess } from "../../hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentVisualization } from "../../hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { useExperimentVisualizationData } from "../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { useExperimentVisualizationDelete } from "../../hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import ExperimentVisualizationDetails from "./experiment-visualization-details";

// Mock the dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("~/hooks/useLocale", () => ({
  useLocale: vi.fn(() => "en"),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

vi.mock("../../hooks/experiment/useExperimentVisualization/useExperimentVisualization", () => ({
  useExperimentVisualization: vi.fn(),
}));

vi.mock("../../hooks/experiment/useExperimentAccess/useExperimentAccess", () => ({
  useExperimentAccess: vi.fn(),
}));

vi.mock(
  "../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData",
  () => ({
    useExperimentVisualizationData: vi.fn(),
  }),
);

vi.mock(
  "../../hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete",
  () => ({
    useExperimentVisualizationDelete: vi.fn(),
  }),
);

vi.mock("./experiment-visualization-renderer", () => ({
  default: vi.fn(({ visualization }: { visualization: ExperimentVisualization }) => (
    <div data-testid="visualization-renderer">{visualization.name}</div>
  )),
}));

describe("ExperimentVisualizationDetails", () => {
  const mockVisualizationId = "viz-123";
  const mockExperimentId = "exp-456";
  const mockRouter = {
    push: vi.fn(),
    back: vi.fn(),
  };

  const mockVisualization = {
    id: mockVisualizationId,
    name: "Test Visualization",
    description: "A test visualization",
    chartFamily: "basic" as const,
    chartType: "line" as const,
    dataConfig: {
      tableName: "test_table",
      dataSources: [
        { columnName: "time", role: "x" as const },
        { columnName: "value", role: "y" as const },
      ],
    },
    appearanceConfig: {},
    createdBy: "user-123",
    createdByName: "Test User",
    createdAt: new Date("2024-01-01").toISOString(),
    updatedAt: new Date("2024-01-15").toISOString(),
  };

  const mockVisualizationData = {
    rows: [
      { time: 1, value: 10 },
      { time: 2, value: 20 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter);

    // Default mock for useExperimentAccess - active experiment
    (useExperimentAccess as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        body: {
          experiment: {
            status: "active",
          },
          hasAccess: true,
          isAdmin: true,
        },
      },
      isLoading: false,
      error: null,
    });
  });

  it("should render loading state", () => {
    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.getByText("ui.messages.loading")).toBeInTheDocument();
  });

  it("should render error state when visualization fails to load", () => {
    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to load"),
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.getByText("ui.messages.failedToLoad")).toBeInTheDocument();
    expect(screen.getByText("ui.actions.back")).toBeInTheDocument();
  });

  it("should render visualization details successfully", () => {
    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: mockVisualization },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    // Use getAllByText since the name appears in both the card title and renderer
    const visualizationNames = screen.getAllByText("Test Visualization");
    expect(visualizationNames.length).toBeGreaterThan(0);
    expect(screen.getByText("A test visualization")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test_table")).toBeInTheDocument();
  });

  it("should display formatted dates", () => {
    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: mockVisualization },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    const createdDate = new Date("2024-01-01").toLocaleDateString();
    const updatedDate = new Date("2024-01-15").toLocaleDateString();

    expect(screen.getByText(createdDate)).toBeInTheDocument();
    expect(screen.getByText(updatedDate)).toBeInTheDocument();
  });

  it("should show columns count", () => {
    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: mockVisualization },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.getByText("2 columns")).toBeInTheDocument();
  });

  it("should render visualization renderer component", () => {
    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: mockVisualization },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.getByTestId("visualization-renderer")).toBeInTheDocument();
  });

  it("should navigate to edit page when edit is clicked", async () => {
    const user = userEvent.setup();

    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: mockVisualization },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    // Open the dropdown menu
    const actionsButton = screen.getByText("ui.actions.title");
    await user.click(actionsButton);

    // Click the edit button
    const editButton = screen.getByText("ui.actions.edit");
    await user.click(editButton);

    expect(mockRouter.push).toHaveBeenCalledWith(
      `/en/platform/experiments/${mockExperimentId}/analysis/visualizations/${mockVisualizationId}/edit`,
    );
  });

  it("should call delete mutation when delete is clicked", async () => {
    const user = userEvent.setup();
    const mockDeleteMutate = vi.fn();

    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: mockVisualization },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    // Open the dropdown menu
    const actionsButton = screen.getByText("ui.actions.title");
    await user.click(actionsButton);

    // Click the delete button
    const deleteButton = screen.getByText("ui.actions.delete");
    await user.click(deleteButton);

    expect(mockDeleteMutate).toHaveBeenCalledWith({
      params: {
        id: mockExperimentId,
        visualizationId: mockVisualizationId,
      },
    });
  });

  it("should show deleting state when deletion is in progress", async () => {
    const user = userEvent.setup();

    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: mockVisualization },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    // Open the dropdown menu
    const actionsButton = screen.getByText("ui.actions.title");
    await user.click(actionsButton);

    expect(screen.getByText("ui.actions.deleting")).toBeInTheDocument();
  });

  it("should navigate back when back button is clicked in error state", async () => {
    const user = userEvent.setup();

    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to load"),
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    const backButton = screen.getByText("ui.actions.back");
    await user.click(backButton);

    expect(mockRouter.push).toHaveBeenCalledWith(`/en/platform/experiments/${mockExperimentId}`);
  });

  it("should handle successful deletion and show toast", async () => {
    let onSuccessCallback: (() => void) | undefined;

    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: mockVisualization },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockImplementation(
      ({ onSuccess }: { onSuccess?: () => void }) => {
        onSuccessCallback = onSuccess;
        return {
          mutate: vi.fn(),
          isPending: false,
        };
      },
    );

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    // Trigger the onSuccess callback
    onSuccessCallback?.();

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "ui.messages.deleteSuccess",
      });
      expect(mockRouter.push).toHaveBeenCalledWith(`/en/platform/experiments/${mockExperimentId}`);
    });
  });

  it("should show truncated user ID when createdByName is not available", () => {
    const vizWithoutName = {
      ...mockVisualization,
      createdByName: undefined,
    };

    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: vizWithoutName },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.getByText("user-123...")).toBeInTheDocument();
  });

  it("should open columns dropdown and show column details", async () => {
    const user = userEvent.setup();

    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: mockVisualization },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    // Click on the columns dropdown
    const columnsDropdown = screen.getByText("2 columns");
    await user.click(columnsDropdown);

    // Check that column names are visible
    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.getByText("value")).toBeInTheDocument();

    // Check that role badges are visible
    const badges = screen.getAllByText(/^[xy]$/);
    expect(badges).toHaveLength(2);
  });

  it("should not render description when not provided", () => {
    const vizWithoutDescription = {
      ...mockVisualization,
      description: null,
    };

    (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: vizWithoutDescription },
      isLoading: false,
      error: null,
    });

    (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockVisualizationData,
    });

    (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    render(
      <ExperimentVisualizationDetails
        visualizationId={mockVisualizationId}
        experimentId={mockExperimentId}
      />,
    );

    expect(screen.queryByText("A test visualization")).not.toBeInTheDocument();
  });

  describe("Archived Experiment", () => {
    beforeEach(() => {
      // Mock archived experiment
      (useExperimentAccess as ReturnType<typeof vi.fn>).mockReturnValue({
        data: {
          body: {
            experiment: {
              status: "archived",
            },
            hasAccess: true,
            isAdmin: false,
          },
        },
        isLoading: false,
        error: null,
      });
    });

    it("should call notFound() when archived experiment is accessed without archive context", () => {
      (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
        data: { body: mockVisualization },
        isLoading: false,
        error: null,
      });

      (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: mockVisualizationData,
      });

      (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      });

      render(
        <ExperimentVisualizationDetails
          visualizationId={mockVisualizationId}
          experimentId={mockExperimentId}
          // isArchiveContext is false by default
        />,
      );

      expect(notFound).toHaveBeenCalled();
    });

    it("should NOT call notFound() when archived experiment is accessed with archive context", () => {
      (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
        data: { body: mockVisualization },
        isLoading: false,
        error: null,
      });

      (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: mockVisualizationData,
      });

      (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      });

      render(
        <ExperimentVisualizationDetails
          visualizationId={mockVisualizationId}
          experimentId={mockExperimentId}
          isArchiveContext={true}
        />,
      );

      expect(notFound).not.toHaveBeenCalled();
    });

    it("should disable actions button when experiment is archived (in archive context)", () => {
      (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
        data: { body: mockVisualization },
        isLoading: false,
        error: null,
      });

      (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: mockVisualizationData,
      });

      (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      });

      render(
        <ExperimentVisualizationDetails
          visualizationId={mockVisualizationId}
          experimentId={mockExperimentId}
          isArchiveContext={true}
        />,
      );

      const actionsButton = screen.getByText("ui.actions.title");
      expect(actionsButton).toBeDisabled();
    });

    it("should not open dropdown menu when actions button is disabled for archived experiment (in archive context)", () => {
      (useExperimentVisualization as ReturnType<typeof vi.fn>).mockReturnValue({
        data: { body: mockVisualization },
        isLoading: false,
        error: null,
      });

      (useExperimentVisualizationData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: mockVisualizationData,
      });

      (useExperimentVisualizationDelete as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      });

      render(
        <ExperimentVisualizationDetails
          visualizationId={mockVisualizationId}
          experimentId={mockExperimentId}
          isArchiveContext={true}
        />,
      );

      const actionsButton = screen.getByText("ui.actions.title");

      // Button should be disabled for archived experiments
      expect(actionsButton).toBeDisabled();

      // Since button is disabled, dropdown menu items should not be accessible
      // We don't click the disabled button as that's not user behavior
      expect(screen.queryByText("ui.actions.edit")).not.toBeInTheDocument();
      expect(screen.queryByText("ui.actions.delete")).not.toBeInTheDocument();
    });
  });
});
