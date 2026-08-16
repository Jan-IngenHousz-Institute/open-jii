import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { DataTable } from "./data-table";
import type { DataRow } from "./data-table-columns";

const COLUMNS: ExperimentDataColumn[] = [
  { name: "measured_at", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "phi2", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "notes", type_name: "STRING", type_text: "STRING" },
  { name: "envelope", type_name: "VARIANT", type_text: "VARIANT" },
];

const ROWS: DataRow[] = [
  {
    id: "row-1",
    measured_at: "2026-08-14T09:30:00.000Z",
    phi2: 0.71,
    notes: "field run",
    envelope: JSON.stringify({ gain: 3 }),
  },
  {
    id: "row-2",
    measured_at: "2026-08-14T10:30:00.000Z",
    phi2: 0.68,
    notes: "field run",
    envelope: JSON.stringify({ gain: 4 }),
  },
];

describe("DataTable", () => {
  it("renders a column per field and a row per record", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByText("phi2")).toBeInTheDocument();
    expect(screen.getByText("notes")).toBeInTheDocument();
    expect(screen.getByText("0.71")).toBeInTheDocument();
    expect(screen.getAllByText("field run")).toHaveLength(2);
  });

  it("renders each value the way its type asks for", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);

    // Timestamps lose their ISO punctuation, numbers are right-aligned, and a
    // variant collapses behind a control rather than spilling its JSON.
    expect(screen.getByText("2026-08-14 09:30:00")).toBeInTheDocument();
    expect(screen.getByText("0.68").className).toContain("text-right");
  });

  it("says so plainly when there are no rows", () => {
    render(<DataTable columns={COLUMNS} rows={[]} />);

    expect(screen.getByText("dataTable.noResults")).toBeInTheDocument();
  });

  it("leaves paging out entirely when the caller does not page", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);

    expect(screen.queryByTitle("dataTable.next")).not.toBeInTheDocument();
  });

  it("hands page changes back to the caller", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        pagination={{
          mode: "server",
          state: { pageIndex: 0, pageSize: 10 },
          onChange,
          totalRows: 50,
          totalPages: 5,
        }}
      />,
    );

    expect(screen.getByText(/dataTable.totalRows.*50/)).toBeInTheDocument();
    await user.click(screen.getByTitle("dataTable.next"));

    expect(onChange).toHaveBeenCalled();
  });

  it("pages rows it already holds, at the size the caller asks for", async () => {
    const user = userEvent.setup();
    const many: DataRow[] = Array.from({ length: 7 }, (_, index) => ({
      id: `row-${String(index)}`,
      measured_at: "2026-08-14T09:30:00.000Z",
      phi2: index / 100,
      notes: `reading ${String(index)}`,
      envelope: "{}",
    }));

    render(
      <DataTable
        columns={COLUMNS}
        rows={many}
        pagination={{ mode: "client", pageSize: 5, pageSizeOptions: [5, 25, 50] }}
      />,
    );

    expect(screen.getByText("reading 4")).toBeInTheDocument();
    expect(screen.queryByText("reading 5")).not.toBeInTheDocument();
    expect(screen.getByText(/dataTable.totalRows.*7/)).toBeInTheDocument();

    await user.click(screen.getByTitle("dataTable.next"));

    expect(screen.getByText("reading 5")).toBeInTheDocument();
    expect(screen.queryByText("reading 4")).not.toBeInTheDocument();
  });

  it("shows selection checkboxes only for a caller that owns a selection", () => {
    const { rerender } = render(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.queryByLabelText("Select all")).not.toBeInTheDocument();

    rerender(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        selection={{ state: { "row-1": true }, onChange: vi.fn() }}
      />,
    );

    expect(screen.getByLabelText("Select all")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Select row")).toHaveLength(2);
  });

  it("renders every row it is given when the caller does not page", () => {
    const many: DataRow[] = Array.from({ length: 11 }, (_, index) => ({
      id: `row-${String(index)}`,
      measured_at: "2026-08-14T09:30:00.000Z",
      phi2: index / 100,
      notes: `reading ${String(index)}`,
      envelope: "{}",
    }));

    render(<DataTable columns={COLUMNS} rows={many} />);

    // An unpaged table with a paging model would stop at tanstack's default
    // page size and hide the eleventh row.
    expect(screen.getByText("reading 10")).toBeInTheDocument();
  });

  it("shows skeletons instead of rows while a page is in flight", () => {
    const { container } = render(
      <DataTable columns={COLUMNS} rows={ROWS} isLoading loadingRowCount={3} />,
    );

    expect(screen.queryByText("field run")).not.toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
  });

  it("reports header clicks on sortable columns to the caller", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        sorting={{ column: "phi2", direction: "ASC", onSort }}
      />,
    );

    await user.click(screen.getByText("phi2"));

    expect(onSort).toHaveBeenCalledWith("phi2", "DOUBLE");
  });

  it("marks the rows an error column flags", () => {
    const failed: DataRow[] = [{ id: "row-3", phi2: 0.4, error_message: "sensor timeout" }];

    const { container } = render(
      <DataTable
        columns={[...COLUMNS, { name: "error_message", type_name: "STRING", type_text: "STRING" }]}
        rows={failed}
        errorColumn="error_message"
      />,
    );

    expect(container.querySelector("tbody tr")?.className).toContain("border-l-destructive");
  });

  it("toggles selection through the header and the row checkboxes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<DataTable columns={COLUMNS} rows={ROWS} selection={{ state: {}, onChange }} />);

    await user.click(screen.getByLabelText("Select all"));
    expect(onChange).toHaveBeenCalled();

    onChange.mockClear();
    await user.click(screen.getAllByLabelText("Select row")[0]);
    expect(onChange).toHaveBeenCalled();
  });

  it("expands a JSON cell into its own row and collapses it again", async () => {
    const user = userEvent.setup();
    const { container } = render(<DataTable columns={COLUMNS} rows={ROWS} />);
    const bodyRows = () => container.querySelectorAll("tbody tr").length;

    expect(bodyRows()).toBe(2);

    // Re-queried each time: the row re-renders, so the earlier node is stale.
    await user.click(screen.getAllByRole("button")[0]);
    expect(bodyRows()).toBe(3);

    await user.click(screen.getAllByRole("button")[0]);
    expect(bodyRows()).toBe(2);
  });

  it("renders the toolbar the surface passes in", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} toolbar={<p>filters go here</p>} />);

    expect(screen.getByText("filters go here")).toBeInTheDocument();
  });
});
