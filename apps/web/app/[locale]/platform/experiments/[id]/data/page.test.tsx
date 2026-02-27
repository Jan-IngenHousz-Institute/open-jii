import { createExperimentAccess, createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentTableName, contract } from "@repo/api";

import ExperimentDataPage from "./page";

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

// --- Tests ---
describe("ExperimentDataPage", () => {
  const experimentId = "exp-123";
  const defaultProps = {
    params: Promise.resolve({ locale: "en-US", id: experimentId }),
  };

  const accessPayload = createExperimentAccess({
    experiment: { id: experimentId, name: "Test Experiment", status: "active" },
    isAdmin: true,
  });

  const mockTablesData = [
    createExperimentTable({
      name: "measurements",
      displayName: "Measurements",
      totalRows: 100,
      defaultSortColumn: "timestamp",
      errorColumn: "error_code",
    }),
    createExperimentTable({
      name: ExperimentTableName.DEVICE,
      displayName: "Device Metadata",
      totalRows: 50,
    }),
  ];

  function mountDefaults() {
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.experiments.getExperimentTables, { body: mockTablesData });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: experimentId, locale: "en-US" });
  });

  it("renders the experiment data page with tabs when loaded", async () => {
    mountDefaults();
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.title")).toBeInTheDocument();
    });
    expect(screen.getByText("experimentData.description")).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("displays loading state when experiment is loading", () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: accessPayload,
      delay: 999_999,
    });
    server.mount(contract.experiments.getExperimentTables, { body: mockTablesData });

    render(<ExperimentDataPage params={defaultProps.params} />);

    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays loading state when tables are loading", () => {
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.experiments.getExperimentTables, {
      body: mockTablesData,
      delay: 999_999,
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays error state for experiment error", async () => {
    server.mount(contract.experiments.getExperimentAccess, { status: 500 });
    server.mount(contract.experiments.getExperimentTables, { body: mockTablesData });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });
  });

  it("displays error state for tables error", async () => {
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.experiments.getExperimentTables, { status: 500 });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });
  });

  it("renders tab triggers for each table with row counts, including device table", async () => {
    mountDefaults();
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Measurements \(100\)/ })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Device Metadata \(50\)/ })).toBeInTheDocument();
    });
  });

  it("renders table content for each tab, including device table", async () => {
    const user = userEvent.setup();
    mountDefaults();
    render(<ExperimentDataPage params={defaultProps.params} />);

    // Measurements is active by default
    await waitFor(() => {
      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("tabpanel")).getByTestId("experiment-data-table"),
    ).toBeInTheDocument();

    // Switch to device tab
    await user.click(screen.getByRole("tab", { name: /Device Metadata/ }));
    await waitFor(() => {
      expect(
        within(screen.getByRole("tabpanel")).getByText("Table: Device Metadata"),
      ).toBeInTheDocument();
    });
  });

  it("displays no data message when tables array is empty", async () => {
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.experiments.getExperimentTables, { body: [] });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.noData")).toBeInTheDocument();
    });
  });

  it("displays device table when it's the only table", async () => {
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.experiments.getExperimentTables, {
      body: [
        createExperimentTable({
          name: ExperimentTableName.DEVICE,
          displayName: "Device Metadata",
          totalRows: 50,
        }),
      ],
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Device Metadata \(50\)/ })).toBeInTheDocument();
    });
  });

  it("calls notFound when experiment is archived", async () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({
        experiment: { id: experimentId, status: "archived" },
      }),
    });
    server.mount(contract.experiments.getExperimentTables, { body: mockTablesData });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });

  it("passes correct properties to ExperimentDataTable", async () => {
    mountDefaults();
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const measurementsTable = screen.getByTestId("experiment-data-table");
      expect(measurementsTable).toHaveAttribute("data-experiment-id", experimentId);
      expect(measurementsTable).toHaveAttribute("data-table-name", "measurements");
      expect(measurementsTable).toHaveAttribute("data-error-column", "error_code");
      expect(measurementsTable).toHaveAttribute("data-default-sort-column", "timestamp");
    });
  });

  it("renders NavTabs with the first table tab active by default", async () => {
    mountDefaults();
    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const measurementsTab = screen.getByRole("tab", { name: /Measurements/ });
      expect(measurementsTab).toHaveAttribute("data-state", "active");
    });
  });

  it("truncates long table names in tabs", async () => {
    const longTableName = "very_long_table_name_that_should_be_truncated";
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.experiments.getExperimentTables, {
      body: [
        createExperimentTable({
          name: longTableName,
          displayName: "Very Long Table Name That Should Be Truncated",
          totalRows: 100,
        }),
      ],
    });

    render(<ExperimentDataPage params={defaultProps.params} />);

    await waitFor(() => {
      const trigger = screen.getByRole("tab", { name: /Very Long Table Name/ });
      expect(trigger).toBeInTheDocument();
      expect(trigger.querySelector(".truncate")).toBeInTheDocument();
    });
  });
});
