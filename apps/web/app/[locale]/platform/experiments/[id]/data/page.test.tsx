import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { notFound } from "next/navigation";
import React, { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentTableName } from "@repo/api";

import ExperimentDataPage from "./page";

globalThis.React = React;

// --- Mocks ---
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

const mockUseExperimentAccess = vi.fn();
vi.mock("@/hooks/experiment/useExperimentAccess/useExperimentAccess", () => ({
  useExperimentAccess: (): unknown => mockUseExperimentAccess(),
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

const mockUseExperimentTables = vi.fn();
vi.mock("~/hooks/experiment/useExperimentTables/useExperimentTables", () => ({
  useExperimentTables: (): unknown => mockUseExperimentTables(),
}));

vi.mock("~/components/experiment-data/experiment-data-table", () => ({
  ExperimentDataTable: ({
    experimentId,
    tableName,
    displayName,
    defaultSortColumn,
    errorColumn,
  }: {
    experimentId: string;
    tableName: string;
    displayName?: string;
    defaultSortColumn?: string;
    errorColumn?: string;
  }) => (
    <div
      data-testid="experiment-data-table"
      data-experiment-id={experimentId}
      data-table-name={tableName}
      data-display-name={displayName}
      data-default-sort-column={defaultSortColumn}
      data-error-column={errorColumn}
    >
      Table: {displayName ?? tableName}
    </div>
  ),
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="button" onClick={onClick}>
      {children}
    </button>
  ),
  NavTabs: ({ children, defaultValue }: { children: React.ReactNode; defaultValue: string }) => (
    <div data-testid="nav-tabs" data-default-value={defaultValue}>
      {children}
    </div>
  ),
  NavTabsList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="nav-tabs-list">{children}</div>
  ),
  NavTabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-testid={`nav-tab-trigger-${value}`}>{children}</button>
  ),
  NavTabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`nav-tab-content-${value}`}>{children}</div>
  ),
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
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
        experiment: {
          id: "exp-123",
          name: "Test Experiment",
          status: "active",
        },
      },
    },
    isLoading: false,
    error: null,
  };

  const mockTablesData = {
    tables: [
      {
        name: "measurements",
        displayName: "Measurements",
        totalRows: 100,
        defaultSortColumn: "timestamp",
        errorColumn: "error_code",
      },
      { name: ExperimentTableName.DEVICE, displayName: "Device Metadata", totalRows: 50 },
    ],
    isLoading: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: "exp-123", locale: "en-US" } as never);
    mockUseExperimentAccess.mockReturnValue(mockExperimentData);
    mockUseExperimentTables.mockReturnValue(mockTablesData);
    mockUseLocale.mockReturnValue("en-US");
    mockUseTranslation.mockReturnValue({
      t: (key: string) => key,
    });
  });

  it("renders the experiment data page with tabs when loaded", async () => {
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.title")).toBeInTheDocument();
      expect(screen.getByText("experimentData.description")).toBeInTheDocument();
      expect(screen.getByTestId("button")).toBeInTheDocument();
      expect(screen.getByTestId("nav-tabs")).toBeInTheDocument();
      expect(screen.getByTestId("nav-tabs-list")).toBeInTheDocument();
    });
  });
  it("displays loading state when experiment is loading", async () => {
    mockUseExperimentAccess.mockReturnValue({
      ...mockExperimentData,
      isLoading: true,
      data: null,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it("displays loading state when tables are loading", async () => {
    mockUseExperimentTables.mockReturnValue({
      ...mockTablesData,
      isLoading: true,
      tables: null,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it("displays error state for experiment error", async () => {
    const error = new Error("Test error");
    mockUseExperimentAccess.mockReturnValue({
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

  it("displays error state for tables error", async () => {
    const error = new Error("Tables error");
    mockUseExperimentTables.mockReturnValue({
      ...mockTablesData,
      isLoading: false,
      tables: null,
      error,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toHaveTextContent(
        "failedToLoad: Error: Tables error",
      );
    });
  });

  it("renders tab triggers for each table with row counts, including device table", async () => {
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const measurementsTab = screen.getByTestId("nav-tab-trigger-measurements");
      expect(measurementsTab).toBeInTheDocument();
      expect(measurementsTab).toHaveTextContent("Measurements (100)");

      // Device table should be present
      const deviceTab = screen.getByTestId("nav-tab-trigger-device");
      expect(deviceTab).toBeInTheDocument();
      expect(deviceTab).toHaveTextContent("Device Metadata (50)");
    });
  });

  it("renders table content for each tab, including device table", async () => {
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("nav-tab-content-measurements")).toBeInTheDocument();
      // Device table content should be rendered
      expect(screen.getByTestId("nav-tab-content-device")).toBeInTheDocument();
    });
  });

  it("displays no data message when tables array is empty", async () => {
    mockUseExperimentTables.mockReturnValue({
      tables: [],
      isLoading: false,
      error: null,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.noData")).toBeInTheDocument();
    });
  });

  it("displays device table when it's the only table", async () => {
    mockUseExperimentTables.mockReturnValue({
      tables: [{ name: ExperimentTableName.DEVICE, displayName: "Device Metadata", totalRows: 50 }],
      isLoading: false,
      error: null,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      // Device table should be shown
      const deviceTab = screen.getByTestId("nav-tab-trigger-device");
      expect(deviceTab).toBeInTheDocument();
      expect(deviceTab).toHaveTextContent("Device Metadata (50)");
    });
  });

  it("calls notFound when experiment is archived", async () => {
    mockUseExperimentAccess.mockReturnValue({
      ...mockExperimentData,
      data: {
        body: {
          experiment: {
            ...mockExperimentData.data.body.experiment,
            status: "archived",
          },
        },
      },
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });

  it("passes correct properties to ExperimentDataTable", async () => {
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const measurementsTable = screen.getAllByTestId("experiment-data-table")[0];
      expect(measurementsTable).toHaveAttribute("data-experiment-id", "exp-123");
      expect(measurementsTable).toHaveAttribute("data-table-name", "measurements");
      expect(measurementsTable).toHaveAttribute("data-error-column", "error_code");
      expect(measurementsTable).toHaveAttribute("data-default-sort-column", "timestamp");
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

  it("displays skeleton while experiment is loading", async () => {
    mockUseExperimentAccess.mockReturnValue({
      ...mockExperimentData,
      isLoading: true,
      data: null,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it("displays skeleton while tables metadata is loading", async () => {
    mockUseExperimentTables.mockReturnValue({
      ...mockTablesData,
      isLoading: true,
      tables: null,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it("renders NavTabs component with correct default value", async () => {
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const navTabs = screen.getByTestId("nav-tabs");
      expect(navTabs).toHaveAttribute("data-default-value", "measurements");
    });
  });

  it("truncates long table names in tabs", async () => {
    const longTableName = "very_long_table_name_that_should_be_truncated";
    mockUseExperimentTables.mockReturnValue({
      tables: [
        {
          name: longTableName,
          displayName: "Very Long Table Name That Should Be Truncated",
          totalRows: 100,
        },
      ],
      isLoading: false,
      error: null,
    });

    const { container } = render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const trigger = screen.getByTestId(`nav-tab-trigger-${longTableName}`);
      expect(trigger).toBeInTheDocument();
      // The truncate class should be present in the parent structure
      expect(container.querySelector(".truncate")).toBeInTheDocument();
    });
  });
});
