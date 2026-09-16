import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { DataTableCellCollapsible } from "./data-table-cell-collapsible";

// Mock child components
vi.mock("./cells/array/data-table-array-cell", () => ({
  ArrayExpandedContent: ({ data }: { data: string }) => (
    <div data-testid="array-content">{data}</div>
  ),
}));

vi.mock("./cells/map/data-table-map-cell", () => ({
  MapExpandedContent: ({ data }: { data: string }) => <div data-testid="map-content">{data}</div>,
}));

vi.mock("./cells/struct/data-table-struct-cell", () => ({
  StructExpandedContent: ({ data }: { data: string }) => (
    <div data-testid="struct-content">{data}</div>
  ),
}));

vi.mock("./cells/variant/data-table-variant-cell", () => ({
  VariantExpandedContent: ({ data }: { data: string }) => (
    <div data-testid="variant-content">{data}</div>
  ),
}));

vi.mock("./cells/chart/chart-expanded-content", () => ({
  ChartExpandedContent: ({ data, columnName }: { data: string; columnName: string }) => (
    <div data-testid="chart-content">
      {columnName}:{data}
    </div>
  ),
}));

function renderInTable(ui: React.ReactElement) {
  return render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );
}

describe("DataTableCellCollapsible", () => {
  const defaultProps = {
    columnCount: 5,
    columnName: "test_col",
    columnType: "STRING",
    cellData: "some data",
  };

  it("renders null for unsupported column type", () => {
    const { container } = render(
      <DataTableCellCollapsible {...defaultProps} columnType="STRING" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders null for non-string cell data", () => {
    const { container } = render(
      <DataTableCellCollapsible
        {...defaultProps}
        columnType="VARIANT"
        cellData={{ some: "obj" }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders VariantExpandedContent for VARIANT type", () => {
    renderInTable(<DataTableCellCollapsible {...defaultProps} columnType="VARIANT" />);

    expect(screen.getByTestId("variant-content")).toHaveTextContent("some data");
    expect(screen.getByRole("row")).toBeInTheDocument();
    expect(screen.getByRole("cell")).toHaveAttribute("colSpan", "6");
  });

  it("renders ArrayExpandedContent for ARRAY<STRUCT<...>> type", () => {
    renderInTable(
      <DataTableCellCollapsible {...defaultProps} columnType="ARRAY<STRUCT<field:string>>" />,
    );

    expect(screen.getByTestId("array-content")).toHaveTextContent("some data");
  });

  it("renders MapExpandedContent for MAP type", () => {
    renderInTable(<DataTableCellCollapsible {...defaultProps} columnType="MAP" />);
    expect(screen.getByTestId("map-content")).toHaveTextContent("some data");
  });

  it("renders MapExpandedContent for MAP<...> type", () => {
    renderInTable(<DataTableCellCollapsible {...defaultProps} columnType="MAP<string,string>" />);
    expect(screen.getByTestId("map-content")).toHaveTextContent("some data");
  });

  it("renders StructExpandedContent for STRUCT type", () => {
    renderInTable(<DataTableCellCollapsible {...defaultProps} columnType="STRUCT" />);
    expect(screen.getByTestId("struct-content")).toHaveTextContent("some data");
  });

  it("renders StructExpandedContent for STRUCT<...> type", () => {
    renderInTable(<DataTableCellCollapsible {...defaultProps} columnType="STRUCT<field:string>" />);
    expect(screen.getByTestId("struct-content")).toHaveTextContent("some data");
  });

  it("renders ChartExpandedContent for a numeric array type, passing columnName through", () => {
    renderInTable(
      <DataTableCellCollapsible {...defaultProps} columnType="ARRAY<DOUBLE>" cellData="[1,2,3]" />,
    );
    expect(screen.getByTestId("chart-content")).toHaveTextContent("test_col:[1,2,3]");
  });

  it("shows the column name in the header", () => {
    renderInTable(<DataTableCellCollapsible {...defaultProps} columnType="VARIANT" />);
    expect(screen.getByText("test_col")).toBeInTheDocument();
  });

  it("renders a close button that calls onClose when clicked, reachable regardless of scroll position", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderInTable(
      <DataTableCellCollapsible {...defaultProps} columnType="VARIANT" onClose={onClose} />,
    );

    // The header (with the close button) sits in the `sticky left-0` wrapper,
    // so it stays visible even if the table is scrolled far horizontally.
    const closeButton = screen.getByRole("button", { name: "common.close" });
    expect(closeButton.closest(".sticky")).toBeInTheDocument();

    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
