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

  it("renders the toolbar the surface passes in", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} toolbar={<p>filters go here</p>} />);

    expect(screen.getByText("filters go here")).toBeInTheDocument();
  });
});
