import { createExperiment, createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { use } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";

import ExperimentDataPage from "./archived-experiment-data-content";

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

vi.mock("@repo/ui/components/nav-tabs", async () => {
  const actual = await vi.importActual("@repo/ui/components/nav-tabs");
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
  };
});

vi.mock("@repo/ui/components/skeleton", async () => {
  const actual = await vi.importActual("@repo/ui/components/skeleton");
  return {
    ...actual,
    Skeleton: ({ className }: { className?: string }) => (
      <div data-testid="skeleton" className={className} />
    ),
  };
});

vi.mock("~/components/experiment-data/upload-data-modal/upload-data-modal", () => ({
  UploadDataModal: ({
    experimentId,
    open,
    onOpenChange,
  }: {
    experimentId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div
      data-testid="upload-data-modal"
      data-experiment-id={experimentId}
      data-open={open}
      onClick={() => onOpenChange(!open)}
    />
  ),
}));

const EXP_ID = "test-experiment-id";
const PARAMS = Promise.resolve({ id: EXP_ID, locale: "en-US" });

const archivedExperiment = createExperiment({ id: EXP_ID, status: "archived" });
const activeExperiment = createExperiment({ id: EXP_ID, status: "active" });

const mockTablesData = [
  createExperimentTable({
    identifier: "measurements",
    displayName: "Measurements",
    totalRows: 100,
    defaultSortColumn: "timestamp",
  }),
  createExperimentTable({
    identifier: ExperimentTableName.DEVICE,
    displayName: "Device",
    totalRows: 1,
  }),
];

function mountDefaults() {
  server.mount(contract.experiments.getExperiment, { body: archivedExperiment });
  server.mount(contract.experiments.getExperimentTables, { body: mockTablesData });
}

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

  it("renders data page with a disabled upload button when experiment is archived", async () => {
    mountDefaults();

    render(<ExperimentDataPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.title")).toBeInTheDocument();
    });

    expect(screen.getByText("experimentData.description")).toBeInTheDocument();

    const uploadButton = screen.getByRole("button", { name: /experimentData.uploadData/i });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();
  });

  it("picks the dataset from a combobox rather than a tab strip", async () => {
    mountDefaults();

    render(<ExperimentDataPage params={PARAMS} />);

    // The archived page is the live page's twin: an experiment can hold a
    // dataset per macro and per upload, which wrapped the strip to three rows.
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("nav-tabs")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Measurements");
  });

  it("renders the selected dataset's table", async () => {
    mountDefaults();

    render(<ExperimentDataPage params={PARAMS} />);

    const dataTable = await screen.findByTestId("experiment-data-table");
    expect(dataTable).toHaveAttribute("data-experiment-id", EXP_ID);
    expect(dataTable).toHaveAttribute("data-table-name", "measurements");
    expect(dataTable).toHaveAttribute("data-default-sort-column", "timestamp");
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
      expect(screen.getByTestId("upload-data-modal")).toBeInTheDocument();
    });

    const modal = screen.getByTestId("upload-data-modal");
    expect(modal).toHaveAttribute("data-open", "false");
    expect(modal).toHaveAttribute("data-experiment-id", EXP_ID);
  });
});
