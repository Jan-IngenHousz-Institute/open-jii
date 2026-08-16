import { render, screen } from "@/test/test-utils";
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
});
