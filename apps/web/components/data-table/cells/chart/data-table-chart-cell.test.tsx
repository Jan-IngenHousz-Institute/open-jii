import { render, userEvent, within } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { DataTableChartCell } from "./data-table-chart-cell";

const mockColumnName = "test_column";
const mockRowId = "row-1";
const mockData = [1, 2, 3, 4, 5];

// Scope every DOM query to the render's container; `isolate: false` leaves
// other files' SVGs/icons in document.body so a global `document.querySelector`
// can pick up the wrong element.
function renderCell(props: Parameters<typeof DataTableChartCell>[0]) {
  const result = render(<DataTableChartCell {...props} />);
  const root = result.container.firstChild;
  if (!(root instanceof HTMLElement)) throw new Error("expected a root element");
  return { ...result, scoped: within(root), root };
}

describe("DataTableChartCell", () => {
  it("renders an SVG when data is an array of numbers", () => {
    const { root } = renderCell({ data: mockData, columnName: mockColumnName, rowId: mockRowId });
    expect(root.querySelector("svg")).toBeInTheDocument();
  });

  it("renders an SVG when data is a JSON-array string", () => {
    const { root } = renderCell({
      data: "[1,2,3,4,5]",
      columnName: mockColumnName,
      rowId: mockRowId,
    });
    expect(root.querySelector("svg")).toBeInTheDocument();
  });

  it("shows 'No data' when the array is empty", () => {
    const { scoped } = renderCell({ data: [], columnName: mockColumnName, rowId: mockRowId });
    expect(scoped.getByText("No data")).toBeInTheDocument();
  });

  it("shows 'No data' when the string represents an empty array", () => {
    const { scoped } = renderCell({ data: "[]", columnName: mockColumnName, rowId: mockRowId });
    expect(scoped.getByText("No data")).toBeInTheDocument();
  });

  it("parses a JSON-array string into rendered points", () => {
    const { root } = renderCell({
      data: "[1.5, 2.7, 3.9]",
      columnName: mockColumnName,
      rowId: mockRowId,
    });
    expect(root.querySelector("svg path")).toBeInTheDocument();
  });

  it("parses a comma-separated string into rendered points", () => {
    const { root } = renderCell({
      data: "1.1,2.2,3.3",
      columnName: mockColumnName,
      rowId: mockRowId,
    });
    expect(root.querySelector("svg path")).toBeInTheDocument();
  });

  it("filters out NaN tokens from a comma-separated string", () => {
    const { root } = renderCell({
      data: "1,invalid,3,NaN,5",
      columnName: mockColumnName,
      rowId: mockRowId,
    });
    expect(root.querySelector("svg path")).toBeInTheDocument();
  });

  it("falls back to 'No data' when the string is unparseable", () => {
    const { scoped } = renderCell({
      data: "invalid-data-that-cannot-be-parsed-[{",
      columnName: mockColumnName,
      rowId: mockRowId,
    });
    expect(scoped.getByText("No data")).toBeInTheDocument();
  });

  it("generates a polyline-style SVG path from the data points", () => {
    const { root } = renderCell({ data: [0, 5, 10], columnName: mockColumnName, rowId: mockRowId });
    const path = root.querySelector("svg path");
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute("d")).toMatch(
      /^M \d+,\d+(\.\d+)? L \d+,\d+(\.\d+)? L \d+,\d+(\.\d+)?$/,
    );
  });

  it("applies hover/cursor classes to the chart cell wrapper", () => {
    const { root } = renderCell({ data: mockData, columnName: mockColumnName, rowId: mockRowId });
    expect(root).toHaveClass("hover:bg-muted/30");
    expect(root).toHaveClass("cursor-pointer");
    expect(root).toHaveClass("relative");
  });

  it("calls onToggleExpansion with the row id and column name when clicked", async () => {
    const onToggleExpansion = vi.fn();
    const { root } = renderCell({
      data: mockData,
      columnName: mockColumnName,
      rowId: mockRowId,
      onToggleExpansion,
    });

    const user = userEvent.setup();
    await user.click(root);

    expect(onToggleExpansion).toHaveBeenCalledWith(mockRowId, mockColumnName);
  });

  it("doesn't call onToggleExpansion when the cell is the empty-state branch", async () => {
    const onToggleExpansion = vi.fn();
    const { scoped } = renderCell({
      data: [],
      columnName: mockColumnName,
      rowId: mockRowId,
      onToggleExpansion,
    });

    const user = userEvent.setup();
    await user.click(scoped.getByText("No data"));

    expect(onToggleExpansion).not.toHaveBeenCalled();
  });
});
