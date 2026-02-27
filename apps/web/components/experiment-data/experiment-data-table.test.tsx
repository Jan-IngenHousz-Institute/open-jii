import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, it, expect, vi } from "vitest";

import { ExperimentDataTable } from "./experiment-data-table";

// useExperimentData — pragmatic mock (heavy: tsr query + tanstack-table column creation + cell formatting)
const mockUseExperimentData = vi.fn();
vi.mock("@/hooks/experiment/useExperimentData/useExperimentData", () => ({
  useExperimentData: (...args: unknown[]) => mockUseExperimentData(...args),
}));

// Sibling mocks (Rule 5) — annotation components, export modal, chart
vi.mock("~/components/experiment-data/annotations/bulk-actions-bar", () => ({
  BulkActionsBar: () => <div>BulkActionsBar</div>,
}));
vi.mock("~/components/experiment-data/annotations/add-annotation-dialog", () => ({
  AddAnnotationDialog: () => null,
}));
vi.mock("~/components/experiment-data/annotations/delete-annotations-dialog", () => ({
  DeleteAnnotationsDialog: () => null,
}));
vi.mock("./data-export-modal/data-export-modal", () => ({
  DataExportModal: () => null,
}));
vi.mock("./table-chart/experiment-data-table-chart", () => ({
  ExperimentDataTableChart: () => <div>Chart</div>,
}));

// Utility component mocks (tested in experiment-data-utils.test.tsx)
vi.mock("~/components/experiment-data/experiment-data-utils", () => ({
  ExperimentTableHeader: ({ headerGroups }: { headerGroups: unknown[] }) => (
    <thead>
      <tr>
        <th>Header ({headerGroups.length} groups)</th>
      </tr>
    </thead>
  ),
  ExperimentDataRows: ({ rows }: { rows: unknown[] }) => (
    <tr>
      <td>{rows.length} data rows</td>
    </tr>
  ),
  LoadingRows: () => (
    <tr>
      <td>Loading rows...</td>
    </tr>
  ),
  formatValue: (v: unknown) => v,
}));

/* ── Test fixtures ── */

const mockColumns: ColumnDef<Record<string, unknown>>[] = [
  { id: "name", accessorKey: "name", header: "Name" },
  { id: "value", accessorKey: "value", header: "Value" },
];

const mockTableMetadata = {
  columns: mockColumns,
  rawColumns: [
    { name: "name", type_name: "STRING" },
    { name: "value", type_name: "INT" },
  ],
  name: "test_table",
  totalPages: 5,
  totalRows: 50,
};

const mockTableRows = [
  { id: "1", name: "Row 1", value: 10 },
  { id: "2", name: "Row 2", value: 20 },
];

function setupHook(overrides: Record<string, unknown> = {}) {
  mockUseExperimentData.mockReturnValue({
    tableMetadata: mockTableMetadata,
    tableRows: mockTableRows,
    isLoading: false,
    error: null,
    ...overrides,
  });
}

const defaultProps = {
  experimentId: "exp-1",
  tableName: "test_table",
  displayName: "Test Table",
  pageSize: 10,
  defaultSortColumn: "timestamp",
};

/* ── Tests ── */

describe("ExperimentDataTable", () => {
  it("shows loading skeletons when no metadata exists yet", () => {
    setupHook({ isLoading: true, tableMetadata: undefined, tableRows: undefined });
    render(<ExperimentDataTable {...defaultProps} />);
    // Skeletons render; display name is NOT in the skeleton view
    expect(screen.queryByText("Test Table")).not.toBeInTheDocument();
  });

  it("shows error message", () => {
    setupHook({ error: new Error("fail"), tableRows: undefined, tableMetadata: undefined });
    render(<ExperimentDataTable {...defaultProps} />);
    expect(screen.getByText("experimentDataTable.error")).toBeInTheDocument();
  });

  it("shows no-data message when not loading and no rows", () => {
    setupHook({ tableRows: undefined, tableMetadata: undefined });
    render(<ExperimentDataTable {...defaultProps} />);
    expect(screen.getByText("experimentDataTable.noData")).toBeInTheDocument();
  });

  it("renders table with display name, total rows, and data rows", () => {
    setupHook();
    render(<ExperimentDataTable {...defaultProps} />);
    expect(screen.getByText("Test Table")).toBeInTheDocument();
    expect(screen.getByText(/experimentDataTable.totalRows.*50/)).toBeInTheDocument();
    expect(screen.getByText("2 data rows")).toBeInTheDocument();
  });

  it("changes page size via select and resets to page 1", async () => {
    setupHook();
    render(<ExperimentDataTable {...defaultProps} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "20" }));

    expect(mockUseExperimentData).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSize: 20, page: 1 }),
    );
  });

  it("navigates pages via next/previous", async () => {
    setupHook();
    render(<ExperimentDataTable {...defaultProps} />);

    const user = userEvent.setup();
    await user.click(screen.getByTitle("experimentDataTable.next"));
    expect(mockUseExperimentData).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));

    await user.click(screen.getByTitle("experimentDataTable.previous"));
    expect(mockUseExperimentData).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it("disables pagination when only one page", () => {
    setupHook({ tableMetadata: { ...mockTableMetadata, totalPages: 1, totalRows: 5 } });
    render(<ExperimentDataTable {...defaultProps} />);

    expect(screen.getByTitle("experimentDataTable.previous")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByTitle("experimentDataTable.next")).toHaveAttribute("aria-disabled", "true");
  });

  it("navigates pages via Arrow keys", async () => {
    setupHook();
    const user = userEvent.setup();
    render(<ExperimentDataTable {...defaultProps} />);

    await user.keyboard("{ArrowRight}");
    expect(mockUseExperimentData).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));

    await user.keyboard("{ArrowLeft}");
    expect(mockUseExperimentData).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it("shows loading rows while data is refreshing (metadata persisted)", async () => {
    setupHook({ isLoading: true, tableRows: undefined });
    render(<ExperimentDataTable {...defaultProps} />);

    // After useEffect persists metadata, component renders LoadingRows instead of skeletons
    await waitFor(() => {
      expect(screen.getByText("Loading rows...")).toBeInTheDocument();
    });
  });

  it("displays page info text", () => {
    setupHook();
    render(<ExperimentDataTable {...defaultProps} />);
    expect(
      screen.getByText(/experimentDataTable.page.*1.*experimentDataTable.pageOf.*5/),
    ).toBeInTheDocument();
  });
});
