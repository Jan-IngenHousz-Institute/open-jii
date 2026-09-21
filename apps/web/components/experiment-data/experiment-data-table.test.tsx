import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, it, expect, vi } from "vitest";

import { ExperimentDataTable } from "./experiment-data-table";

const mockUseExperimentData = vi.fn();
vi.mock("@/hooks/experiment/useExperimentData/useExperimentData", () => ({
  useExperimentData: (...args: unknown[]): unknown => mockUseExperimentData(...args),
}));

vi.mock("~/components/experiment-data/annotations/bulk-actions-bar", () => ({
  BulkActionsBar: ({
    onAddAnnotation,
    onDeleteAnnotations,
  }: {
    onAddAnnotation: (rowIds: string[], type?: string) => void;
    onDeleteAnnotations: (rowIds: string[], type?: string) => void;
  }) => (
    <div>
      BulkActionsBar
      <button type="button" onClick={() => onAddAnnotation(["1"])}>
        Add Annotation
      </button>
      <button type="button" onClick={() => onDeleteAnnotations(["1"], "flag")}>
        Delete Annotation
      </button>
    </div>
  ),
}));
vi.mock("~/components/experiment-data/annotations/add-annotation-dialog", () => ({
  AddAnnotationDialog: ({
    open,
    rowIds,
    type,
  }: {
    open: boolean;
    rowIds: string[];
    type: string;
  }) => (open ? <div>{`AddAnnotationDialog for ${rowIds.join(",")} (${type})`}</div> : null),
}));
vi.mock("~/components/experiment-data/annotations/delete-annotations-dialog", () => ({
  DeleteAnnotationsDialog: ({
    open,
    rowIds,
    type,
  }: {
    open: boolean;
    rowIds: string[];
    type: string;
  }) => (open ? <div>{`DeleteAnnotationsDialog for ${rowIds.join(",")} (${type})`}</div> : null),
}));
vi.mock("./data-export-modal/data-export-modal", () => ({
  DataExportModal: () => null,
}));

vi.mock("~/components/data-table/data-table-utils", () => ({
  DataTableHeader: ({ headerGroups }: { headerGroups: unknown[] }) => (
    <thead>
      <tr>
        <th>Header ({headerGroups.length} groups)</th>
      </tr>
    </thead>
  ),
  DataTableRows: ({ rows }: { rows: unknown[] }) => (
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

const mockColumns: ColumnDef<DataTableFeatures, Record<string, unknown>>[] = [
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
    expect(screen.getByText(/dataTable.totalRows.*50/)).toBeInTheDocument();
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

  it("changes page size to 1000 via select and shows it selected", async () => {
    setupHook();
    render(<ExperimentDataTable {...defaultProps} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "1000" }));

    expect(mockUseExperimentData).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSize: 1000, page: 1 }),
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("1000");
  });

  it("navigates pages via next/previous", async () => {
    setupHook();
    render(<ExperimentDataTable {...defaultProps} />);

    const user = userEvent.setup();
    await user.click(screen.getByTitle("dataTable.next"));
    expect(mockUseExperimentData).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));

    await user.click(screen.getByTitle("dataTable.previous"));
    expect(mockUseExperimentData).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it("disables pagination when only one page", () => {
    setupHook({ tableMetadata: { ...mockTableMetadata, totalPages: 1, totalRows: 5 } });
    render(<ExperimentDataTable {...defaultProps} />);

    expect(screen.getByTitle("dataTable.previous")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTitle("dataTable.next")).toHaveAttribute("aria-disabled", "true");
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
    expect(screen.getByText(/dataTable.page.*1.*dataTable.pageOf.*5/)).toBeInTheDocument();
  });

  it("opens the add-annotation dialog with the clicked rows and default type", async () => {
    setupHook();
    render(<ExperimentDataTable {...defaultProps} canContribute />);

    const user = userEvent.setup();
    await user.click(screen.getByText("Add Annotation"));

    expect(screen.getByText("AddAnnotationDialog for 1 (comment)")).toBeInTheDocument();
  });

  it("opens the delete-annotations dialog with the clicked rows and type", async () => {
    setupHook();
    render(<ExperimentDataTable {...defaultProps} canContribute />);

    const user = userEvent.setup();
    await user.click(screen.getByText("Delete Annotation"));

    expect(screen.getByText("DeleteAnnotationsDialog for 1 (flag)")).toBeInTheDocument();
  });
});
