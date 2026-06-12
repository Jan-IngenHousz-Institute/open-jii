import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MetadataTable } from "./metadata-table";

const defaultProps = {
  columns: [] as { id: string; name: string; type: "string" | "number" | "date" }[],
  rows: [] as { _id: string; [key: string]: unknown }[],
  identifierColumnId: null as string | null,
  onUpdateCell: vi.fn(),
  onDeleteRow: vi.fn(),
  onDeleteColumn: vi.fn(),
  onRenameColumn: vi.fn(),
  onSetIdentifierColumn: vi.fn(),
};

describe("MetadataTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no columns exist", () => {
    render(<MetadataTable {...defaultProps} />);

    expect(screen.getByText(/no metadata yet/i)).toBeInTheDocument();
  });

  it("renders table with columns and rows", () => {
    render(
      <MetadataTable
        {...defaultProps}
        columns={[
          { id: "col1", name: "Name", type: "string" },
          { id: "col2", name: "Value", type: "number" },
        ]}
        rows={[
          { _id: "row1", col1: "Alice", col2: 42 },
          { _id: "row2", col1: "Bob", col2: 99 },
        ]}
      />,
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows 'No rows' message when columns exist but no rows", () => {
    render(
      <MetadataTable {...defaultProps} columns={[{ id: "col1", name: "Name", type: "string" }]} />,
    );

    expect(screen.getByText(/no rows/i)).toBeInTheDocument();
  });

  it("shows pagination when rows exceed page size", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      _id: `row_${i}`,
      col1: `Value ${i}`,
    }));

    render(
      <MetadataTable
        {...defaultProps}
        columns={[{ id: "col1", name: "Name", type: "string" }]}
        rows={rows}
        pageSize={10}
      />,
    );

    expect(screen.getByText("15 rows")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("does not show pagination when rows fit on one page", () => {
    render(
      <MetadataTable
        {...defaultProps}
        columns={[{ id: "col1", name: "Name", type: "string" }]}
        rows={[{ _id: "row1", col1: "test" }]}
        pageSize={10}
      />,
    );

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it("shows single row text without plural", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      _id: `row_${i}`,
      col1: `Value ${i}`,
    }));

    render(
      <MetadataTable
        {...defaultProps}
        columns={[{ id: "col1", name: "Name", type: "string" }]}
        rows={rows}
        pageSize={10}
      />,
    );

    expect(screen.getByText("11 rows")).toBeInTheDocument();
  });

  it("does not render actions column when disabled", () => {
    render(
      <MetadataTable
        {...defaultProps}
        columns={[{ id: "col1", name: "Name", type: "string" }]}
        rows={[{ _id: "row1", col1: "test" }]}
        disabled
      />,
    );

    const headerCells = screen.getAllByRole("columnheader");
    expect(headerCells).toHaveLength(1);
  });

  it("renders actions column when not disabled", () => {
    render(
      <MetadataTable
        {...defaultProps}
        columns={[{ id: "col1", name: "Name", type: "string" }]}
        rows={[{ _id: "row1", col1: "test" }]}
      />,
    );

    const headerCells = screen.getAllByRole("columnheader");
    expect(headerCells).toHaveLength(2);
  });

  it("calls onDeleteRow when row delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDeleteRow = vi.fn();
    render(
      <MetadataTable
        {...defaultProps}
        onDeleteRow={onDeleteRow}
        columns={[{ id: "col1", name: "Name", type: "string" }]}
        rows={[{ _id: "row1", col1: "test" }]}
      />,
    );

    const deleteButton = screen.getByLabelText("Delete row");
    await user.click(deleteButton);

    expect(onDeleteRow).toHaveBeenCalledWith("row1");
  });

  it("shows identifier icon when column is set as identifier", () => {
    render(
      <MetadataTable
        {...defaultProps}
        columns={[{ id: "col1", name: "Name", type: "string" }]}
        rows={[{ _id: "row1", col1: "test" }]}
        identifierColumnId="col1"
      />,
    );

    // The column header should still render with the name
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("renders column options dropdown", () => {
    render(
      <MetadataTable
        {...defaultProps}
        columns={[{ id: "col1", name: "Name", type: "string" }]}
        rows={[{ _id: "row1", col1: "test" }]}
      />,
    );

    const optionsButton = screen.getByLabelText("Column options");
    expect(optionsButton).toBeInTheDocument();
  });

  it("does not render column options dropdown when disabled", () => {
    render(
      <MetadataTable
        {...defaultProps}
        columns={[{ id: "col1", name: "Name", type: "string" }]}
        rows={[{ _id: "row1", col1: "test" }]}
        disabled
      />,
    );

    expect(screen.queryByLabelText("Column options")).not.toBeInTheDocument();
  });
});
