import { createExperiment, createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { use } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { contract, ExperimentTableName } from "@repo/api";

import ExperimentDataPage from "./page";

// Mock ExperimentDataTable (sibling — Rule 5)
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

// Mock UI components — pragmatic (NavTabs relies on URL-based routing; Skeleton needs testid for query)
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

// Mock DataUploadModal (sibling — Rule 5)
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

/* --------------------------------- Helpers -------------------------------- */

const EXP_ID = "test-experiment-id";
const PARAMS = Promise.resolve({ id: EXP_ID, locale: "en-US" });

const archivedExperiment = createExperiment({ id: EXP_ID, status: "archived" });
const activeExperiment = createExperiment({ id: EXP_ID, status: "active" });

const mockTablesData = [
  createExperimentTable({
    name: "measurements",
    displayName: "Measurements",
    totalRows: 100,
    defaultSortColumn: "timestamp",
  }),
  createExperimentTable({ name: ExperimentTableName.DEVICE, displayName: "Device", totalRows: 1 }),
];

/** Mount both query endpoints with sensible archived defaults. */
function mountDefaults() {
  server.mount(contract.experiments.getExperiment, { body: archivedExperiment });
  server.mount(contract.experiments.getExperimentTables, { body: mockTablesData });
}

/* ---------------------------------- Tests --------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(use).mockReturnValue({ id: EXP_ID });

  vi.spyOn(console, "error").mockImplementation(() => {
    /* no-op */
  });
});

describe("<ExperimentDataPage />", () => {
  it("shows loading skeleton when data is loading", () => {
    server.mount(contract.experiments.getExperiment, { delay: "infinite" });
    server.mount(contract.experiments.getExperimentTables, { delay: "infinite" });

    render(<ExperimentDataPage params={PARAMS} />);

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders ErrorDisplay when there is an error loading experiment", async () => {
    server.mount(contract.experiments.getExperiment, { status: 500 });
    server.mount(contract.experiments.getExperimentTables, { body: mockTablesData });

    render(<ExperimentDataPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByText("failedToLoad")).toBeInTheDocument();
    });
  });

  it("renders ErrorDisplay when there is an error loading tables", async () => {
    server.mount(contract.experiments.getExperiment, { body: archivedExperiment });
    server.mount(contract.experiments.getExperimentTables, { status: 500 });

    render(<ExperimentDataPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByText("failedToLoad")).toBeInTheDocument();
    });
  });

  it("calls notFound when experiment is not archived", async () => {
    server.mount(contract.experiments.getExperiment, { body: activeExperiment });
    server.mount(contract.experiments.getExperimentTables, { body: mockTablesData });

    render(<ExperimentDataPage params={PARAMS} />);

    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });

  it("renders data page with upload button and tabs when experiment is archived", async () => {
    mountDefaults();

    render(<ExperimentDataPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.title")).toBeInTheDocument();
    });

    expect(screen.getByText("experimentData.description")).toBeInTheDocument();

    const uploadButton = screen.getByRole("button", { name: /experimentData.uploadData/i });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();

    expect(screen.getByTestId("nav-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("nav-tabs-list")).toBeInTheDocument();
  });

  it("renders tab triggers with table names and row counts", async () => {
    mountDefaults();

    render(<ExperimentDataPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByTestId("nav-tab-trigger-measurements")).toBeInTheDocument();
    });

    expect(screen.getByText("Measurements (100)")).toBeInTheDocument();
    expect(screen.getByTestId("nav-tab-trigger-device")).toBeInTheDocument();
    expect(screen.getByText("Device (1)")).toBeInTheDocument();
  });

  it("renders tab content with ExperimentDataTable for each table", async () => {
    mountDefaults();

    render(<ExperimentDataPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByTestId("nav-tab-content-measurements")).toBeInTheDocument();
    });

    const tabContent1 = screen.getByTestId("nav-tab-content-measurements");
    const dataTable1 = tabContent1.querySelector('[data-testid="experiment-data-table"]');
    expect(dataTable1).toHaveAttribute("data-experiment-id", EXP_ID);
    expect(dataTable1).toHaveAttribute("data-table-name", "measurements");
    expect(dataTable1).toHaveAttribute("data-default-sort-column", "timestamp");

    const tabContent2 = screen.getByTestId("nav-tab-content-device");
    const dataTable2 = tabContent2.querySelector('[data-testid="experiment-data-table"]');
    expect(dataTable2).toHaveAttribute("data-experiment-id", EXP_ID);
    expect(dataTable2).toHaveAttribute("data-table-name", ExperimentTableName.DEVICE);
  });

  it("shows no data message when tables array is empty", async () => {
    server.mount(contract.experiments.getExperiment, { body: archivedExperiment });
    server.mount(contract.experiments.getExperimentTables, { body: [] });

    render(<ExperimentDataPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.noData")).toBeInTheDocument();
    });
  });

  it("renders the upload modal as closed initially", async () => {
    mountDefaults();

    render(<ExperimentDataPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByTestId("data-upload-modal")).toBeInTheDocument();
    });

    const modal = screen.getByTestId("data-upload-modal");
    expect(modal).toHaveAttribute("data-open", "false");
    expect(modal).toHaveAttribute("data-experiment-id", EXP_ID);
  });
});
