import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { use } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useExperimentTables } from "~/hooks/experiment/useExperimentTables/useExperimentTables";

import { ExperimentTableName } from "@repo/api";

import ExperimentDataPage from "./page";

// Mock useExperiment hook
vi.mock("@/hooks/experiment/useExperiment/useExperiment", () => ({
  useExperiment: vi.fn(),
}));

// Mock translation hook
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock useExperimentTables hook
vi.mock("~/hooks/experiment/useExperimentTables/useExperimentTables", () => ({
  useExperimentTables: vi.fn(),
}));

// Mock ExperimentDataTable component
vi.mock("~/components/experiment-data/experiment-data-table", () => ({
  ExperimentDataTable: ({
    experimentId,
    tableName,
    displayName,
    defaultSortColumn,
  }: {
    experimentId: string;
    tableName: string;
    displayName?: string;
    defaultSortColumn?: string;
  }) => (
    <div
      data-testid="experiment-data-table"
      data-experiment-id={experimentId}
      data-table-name={tableName}
      data-display-name={displayName}
      data-default-sort-column={defaultSortColumn}
    >
      Table: {displayName ?? tableName}
    </div>
  ),
}));

// Mock UI components
vi.mock("@repo/ui/components", async () => {
  const actual = await vi.importActual("@repo/ui/components");
  return {
    ...actual,
    NavTabs: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="nav-tabs">{children}</div>
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
  };
});

// Mock DataUploadModal component
vi.mock("~/components/experiment-data/data-upload-modal/data-upload-modal", () => ({
  DataUploadModal: ({
    experimentId,
    open,
    onOpenChange,
  }: {
    experimentId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div
      data-testid="data-upload-modal"
      data-experiment-id={experimentId}
      data-open={open}
      onClick={() => onOpenChange(!open)}
    />
  ),
}));

const mockTablesData = [
  {
    name: "measurements",
    displayName: "Measurements",
    totalRows: 100,
    defaultSortColumn: "timestamp",
  },
  { name: ExperimentTableName.DEVICE, displayName: "Device", totalRows: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(use).mockReturnValue({ id: "test-experiment-id" });
  vi.mocked(useExperimentTables).mockReturnValue({
    tables: mockTablesData,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useExperimentTables>);
});
describe("<ExperimentDataPage />", () => {
  it("shows loading when experiment is loading", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows loading when tables are loading", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "archived" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    vi.mocked(useExperimentTables).mockReturnValue({
      tables: [],
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useExperimentTables>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders ErrorDisplay when there is an error loading experiment", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByText("failedToLoad")).toBeInTheDocument();
    expect(screen.getByText("fail")).toBeInTheDocument();
  });

  it("renders ErrorDisplay when there is an error loading tables", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "archived" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    vi.mocked(useExperimentTables).mockReturnValue({
      tables: [],
      isLoading: false,
      error: new Error("tables fail"),
    } as unknown as ReturnType<typeof useExperimentTables>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByText("failedToLoad")).toBeInTheDocument();
    expect(screen.getByText("tables fail")).toBeInTheDocument();
  });

  it("shows notFound text when experiment data is missing", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  it("calls notFound when experiment is not archived", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "active" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    // Make notFound throw so render will surface it
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("notFound");
    });

    expect(() =>
      render(
        <ExperimentDataPage
          params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
        />,
      ),
    ).toThrow("notFound");
  });

  it("renders data page with upload button and tabs when experiment is archived", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "archived" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    // Check page title and description
    expect(screen.getByText("experimentData.title")).toBeInTheDocument();
    expect(screen.getByText("experimentData.description")).toBeInTheDocument();

    // Check upload button is rendered and disabled
    const uploadButton = screen.getByRole("button", { name: /experimentData.uploadData/i });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();

    // Check tabs are rendered
    expect(screen.getByTestId("nav-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("nav-tabs-list")).toBeInTheDocument();
  });

  it("renders tab triggers with table names and row counts", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "archived" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByTestId("nav-tab-trigger-measurements")).toBeInTheDocument();
    expect(screen.getByText("Measurements (100)")).toBeInTheDocument();
    expect(screen.getByTestId("nav-tab-trigger-device")).toBeInTheDocument();
    expect(screen.getByText("Device (1)")).toBeInTheDocument();
  });

  it("renders tab content with ExperimentDataTable for each table", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "archived" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    const tabContent1 = screen.getByTestId("nav-tab-content-measurements");
    expect(tabContent1).toBeInTheDocument();
    const dataTable1 = tabContent1.querySelector('[data-testid="experiment-data-table"]');
    expect(dataTable1).toHaveAttribute("data-experiment-id", "test-experiment-id");
    expect(dataTable1).toHaveAttribute("data-table-name", "measurements");
    expect(dataTable1).toHaveAttribute("data-default-sort-column", "timestamp");

    const tabContent2 = screen.getByTestId("nav-tab-content-device");
    expect(tabContent2).toBeInTheDocument();
    const dataTable2 = tabContent2.querySelector('[data-testid="experiment-data-table"]');
    expect(dataTable2).toHaveAttribute("data-experiment-id", "test-experiment-id");
    expect(dataTable2).toHaveAttribute("data-table-name", ExperimentTableName.DEVICE);
  });

  it("shows no data message when tables array is empty", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "archived" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    vi.mocked(useExperimentTables).mockReturnValue({
      tables: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperimentTables>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByText("experimentData.noData")).toBeInTheDocument();
  });

  it("opens and closes the upload modal when button is clicked", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "archived" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    // Modal should be closed initially
    const modal = screen.getByTestId("data-upload-modal");
    expect(modal).toHaveAttribute("data-open", "false");

    expect(modal).toHaveAttribute("data-experiment-id", "test-experiment-id");
  });
});
