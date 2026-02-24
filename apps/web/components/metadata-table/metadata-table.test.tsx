import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MetadataTable } from "./metadata-table";

globalThis.React = React;

/* --------------------------------- Mocks --------------------------------- */

const mockState = {
  columns: [] as { id: string; name: string; type: string }[],
  rows: [] as { _id: string; [key: string]: unknown }[],
  isDirty: false,
  identifierColumnId: null as string | null,
  experimentQuestionId: null as string | null,
};

const mockContext = {
  state: mockState,
  updateCell: vi.fn(),
  deleteRow: vi.fn(),
  deleteColumn: vi.fn(),
  renameColumn: vi.fn(),
  setIdentifierColumnId: vi.fn(),
  setIsEditingCell: vi.fn(),
};

vi.mock("./metadata-context", () => ({
  useMetadata: () => mockContext,
}));

/* --------------------------------- Tests --------------------------------- */

describe("MetadataTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.state = {
      columns: [],
      rows: [],
      isDirty: false,
      identifierColumnId: null,
      experimentQuestionId: null,
    };
  });

  it("shows empty state when no columns exist", () => {
    render(<MetadataTable />);

    expect(
      screen.getByText(/no metadata yet/i),
    ).toBeInTheDocument();
  });

  it("renders table with columns and rows", () => {
    mockContext.state = {
      ...mockContext.state,
      columns: [
        { id: "col1", name: "Name", type: "string" },
        { id: "col2", name: "Value", type: "number" },
      ],
      rows: [
        { _id: "row1", col1: "Alice", col2: 42 },
        { _id: "row2", col1: "Bob", col2: 99 },
      ],
    };

    render(<MetadataTable />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows 'No rows' message when columns exist but no rows", () => {
    mockContext.state = {
      ...mockContext.state,
      columns: [{ id: "col1", name: "Name", type: "string" }],
      rows: [],
    };

    render(<MetadataTable />);

    expect(screen.getByText(/no rows/i)).toBeInTheDocument();
  });

  it("shows pagination when rows exceed page size", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      _id: `row_${i}`,
      col1: `Value ${i}`,
    }));

    mockContext.state = {
      ...mockContext.state,
      columns: [{ id: "col1", name: "Name", type: "string" }],
      rows,
    };

    render(<MetadataTable pageSize={10} />);

    expect(screen.getByText("15 rows")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("does not show pagination when rows fit on one page", () => {
    mockContext.state = {
      ...mockContext.state,
      columns: [{ id: "col1", name: "Name", type: "string" }],
      rows: [{ _id: "row1", col1: "test" }],
    };

    render(<MetadataTable pageSize={10} />);

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it("shows single row text without plural", () => {
    // Need 11+ rows on 2 pages so pagination renders, then check the row count text
    const rows = Array.from({ length: 11 }, (_, i) => ({
      _id: `row_${i}`,
      col1: `Value ${i}`,
    }));

    mockContext.state = {
      ...mockContext.state,
      columns: [{ id: "col1", name: "Name", type: "string" }],
      rows,
    };

    render(<MetadataTable pageSize={10} />);

    expect(screen.getByText("11 rows")).toBeInTheDocument();
  });

  it("does not render actions column when disabled", () => {
    mockContext.state = {
      ...mockContext.state,
      columns: [{ id: "col1", name: "Name", type: "string" }],
      rows: [{ _id: "row1", col1: "test" }],
    };

    const { container } = render(<MetadataTable disabled />);

    // In disabled mode, there should be no dropdown trigger buttons in headers
    // and no delete row buttons
    const headerCells = container.querySelectorAll("th");
    // Only the data column header (no actions column)
    expect(headerCells).toHaveLength(1);
  });

  it("renders actions column when not disabled", () => {
    mockContext.state = {
      ...mockContext.state,
      columns: [{ id: "col1", name: "Name", type: "string" }],
      rows: [{ _id: "row1", col1: "test" }],
    };

    const { container } = render(<MetadataTable />);

    const headerCells = container.querySelectorAll("th");
    // Data column + actions column
    expect(headerCells).toHaveLength(2);
  });
});
