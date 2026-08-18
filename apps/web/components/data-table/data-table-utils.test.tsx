import { render, screen, userEvent } from "@/test/test-utils";
import type { HeaderGroup, Row } from "@tanstack/react-table";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { formatValue, LoadingRows, DataTableHeader, DataTableRows } from "./data-table-utils";

vi.mock("./cells/array/data-table-array-cell", () => ({
  DataTableArrayCell: ({ data }: { data: string }) => {
    try {
      const arr = JSON.parse(data) as unknown[];
      return <span>{arr.length} items</span>;
    } catch {
      return <span>{data}</span>;
    }
  },
}));

vi.mock("./cells/chart/data-table-chart-cell", () => ({
  DataTableChartCell: ({ data }: { data: string }) => <span>chart:{data}</span>,
}));

vi.mock("./cells/map/data-table-map-cell", () => ({
  DataTableMapCell: ({ data }: { data: string }) => {
    try {
      const obj = JSON.parse(data) as Record<string, unknown>;
      return <span>{Object.keys(obj).length} map entries</span>;
    } catch {
      return <span>{data}</span>;
    }
  },
}));

vi.mock("./cells/annotations/data-table-annotations-cell", () => ({
  DataTableAnnotationsCell: ({ data }: { data: string }) => {
    try {
      const arr = JSON.parse(data) as unknown[];
      return <span>{arr.length} annotations</span>;
    } catch {
      return <span>no annotations</span>;
    }
  },
}));

vi.mock("./cells/user/data-table-user-cell", () => ({
  DataTableUserCell: ({ data }: { data: string }) => {
    try {
      const parsed = JSON.parse(data) as { name?: string };
      return <span>{parsed.name ?? "Unknown User"}</span>;
    } catch {
      return <span>{data}</span>;
    }
  },
}));

vi.mock("./cells/text/data-table-text-cell", () => ({
  DataTableTextCell: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("./cells/struct/data-table-struct-cell", () => ({
  DataTableStructCell: ({ data }: { data: string }) => <span>struct:{data}</span>,
}));

vi.mock("./cells/variant/data-table-variant-cell", () => ({
  DataTableVariantCell: () => <span>variant</span>,
}));

vi.mock("./cells/error/data-table-error-cell", () => ({
  DataTableErrorCell: ({ error }: { error: string }) => <span>error:{error}</span>,
}));

vi.mock("./data-table-cell-collapsible", () => ({
  DataTableCellCollapsible: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("formatValue", () => {
  it.each([
    ["DOUBLE", 123.45],
    ["INT", 42],
    ["LONG", 1234567890],
    ["BIGINT", 9876543210],
  ])("right-aligns %s values", (type, value) => {
    const result = formatValue(value, type, "row-1");
    expect(result).toEqual(<div className="text-right tabular-nums">{value}</div>);
  });

  it("formats TIMESTAMP by truncating and replacing T", () => {
    const result = formatValue("2023-01-01T10:30:45.123Z", "TIMESTAMP", "row-1");
    expect(result).toBe("2023-01-01 10:30:45");
  });

  it("returns empty string for null", () => {
    expect(formatValue(null, "STRING", "row-1")).toBe("");
  });

  it("renders user cell for CONTRIBUTOR type", () => {
    const userData = JSON.stringify({ id: "u1", name: "John Doe", image: "" });
    const result = formatValue(userData, WellKnownColumnTypes.CONTRIBUTOR, "row-1", "col");
    render(<div>{result}</div>);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders device cell for DEVICE type", () => {
    const deviceData = JSON.stringify({ id: "d-1", serial_number: "AA:11", status: "active" });
    const result = formatValue(deviceData, WellKnownColumnTypes.DEVICE, "row-1", "col");
    render(<div>{result}</div>);
    expect(screen.getByText("AA:11")).toBeInTheDocument();
  });

  it("renders map cell for MAP types", () => {
    const result = formatValue('{"a":"1","b":"2"}', "MAP<STRING,STRING>", "row-1", "col");
    render(<div>{result}</div>);
    expect(screen.getByText("2 map entries")).toBeInTheDocument();
  });

  it("renders array cell for ARRAY<STRUCT<...>> types", () => {
    const data = JSON.stringify([{ q: "a" }, { q: "b" }]);
    const result = formatValue(data, "ARRAY<STRUCT<q: STRING>>", "row-1", "col");
    render(<div>{result}</div>);
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("renders chart cell for numeric array types", () => {
    const result = formatValue("[1.5, 2.3]", "ARRAY<DOUBLE>", "row-1", "col", vi.fn());
    expect(React.isValidElement(result)).toBe(true);
  });

  it("renders annotations cell for annotation struct type", () => {
    const data = JSON.stringify([{ id: "a1", type: "comment" }]);
    const result = formatValue(
      data,
      "ARRAY<STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>",
      "row-1",
      "annotations",
      undefined,
      vi.fn(),
      vi.fn(),
    );
    render(<div>{result}</div>);
    expect(screen.getByText("1 annotations")).toBeInTheDocument();
  });

  it("renders variant cell for VARIANT type", () => {
    const result = formatValue('{"x":1}', "VARIANT", "row-1", "col");
    render(<div>{result}</div>);
    expect(screen.getByText("variant")).toBeInTheDocument();
  });

  it("falls back to text cell for unknown types", () => {
    const result = formatValue("hello", "UNKNOWN_TYPE", "row-1");
    render(<div>{result}</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});

describe("LoadingRows", () => {
  it("renders the correct number of skeleton cells", () => {
    render(
      <table>
        <tbody>
          <LoadingRows rowCount={3} columnCount={2} />
        </tbody>
      </table>,
    );
    // 3 rows × 2 columns = 6 cells, each containing a Skeleton
    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(6);
  });
});

describe("DataTableHeader", () => {
  function makeHeaderGroup(
    headers: {
      id: string;
      type?: string;
      header?: string | (() => React.ReactNode);
      size?: number;
      isPlaceholder?: boolean;
    }[],
  ) {
    return [
      {
        id: "hg1",
        depth: 0,
        headers: headers.map((h) => ({
          id: h.id,
          column: {
            id: h.id,
            columnDef: {
              header: h.header ?? h.id,
              size: h.size ?? 150,
              meta: h.type ? { type: h.type } : undefined,
            },
          },
          isPlaceholder: h.isPlaceholder ?? false,
          getContext: () => ({}),
        })),
      },
    ] as unknown as HeaderGroup<Record<string, unknown>>[];
  }

  it("renders header text and aligns numeric types right", () => {
    const hg = makeHeaderGroup([
      { id: "name", type: "STRING" },
      { id: "value", type: "DOUBLE" },
      { id: "count", type: "INT" },
    ]);

    render(
      <table>
        <DataTableHeader headerGroups={hg} />
      </table>,
    );

    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("name").closest("th")).toHaveClass("text-left");
    expect(screen.getByText("value").closest("th")).toHaveClass("text-right");
    expect(screen.getByText("count").closest("th")).toHaveClass("text-right");
  });

  it("does not render placeholder headers", () => {
    const hg = makeHeaderGroup([
      { id: "visible", type: "STRING" },
      { id: "hidden", type: "STRING", isPlaceholder: true },
    ]);

    render(
      <table>
        <DataTableHeader headerGroups={hg} />
      </table>,
    );

    expect(screen.getByText("visible")).toBeInTheDocument();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });

  it("makes sortable columns clickable and calls onSort", async () => {
    const onSort = vi.fn();
    const hg = makeHeaderGroup([{ id: "name", type: "STRING" }]);

    render(
      <table>
        <DataTableHeader headerGroups={hg} sortColumn="name" sortDirection="DESC" onSort={onSort} />
      </table>,
    );

    const nameEl = screen.getByText("name");
    expect(nameEl.closest("th")).toHaveClass("cursor-pointer");
    const user = userEvent.setup();
    await user.click(nameEl);
    expect(onSort).toHaveBeenCalledWith("name", "STRING");
  });

  it.each(["MAP<STRING,STRING>", "ARRAY<STRUCT<...>>", "STRUCT<field1: STRING>"])(
    "does not make %s columns sortable",
    (type) => {
      const onSort = vi.fn();
      const hg = makeHeaderGroup([{ id: "col", type, header: "Col" }]);

      render(
        <table>
          <DataTableHeader headerGroups={hg} onSort={onSort} />
        </table>,
      );

      expect(screen.getByText("Col").closest("th")).not.toHaveClass("cursor-pointer");
    },
  );

  it("does not make the select (checkbox) column sortable", () => {
    const onSort = vi.fn();
    const hg = makeHeaderGroup([
      { id: "select", header: () => <span>Select</span> },
      { id: "name", type: "STRING" },
    ]);

    render(
      <table>
        <DataTableHeader headerGroups={hg} onSort={onSort} sortColumn="name" sortDirection="ASC" />
      </table>,
    );

    expect(screen.getByText("Select").closest("th")).not.toHaveClass("cursor-pointer");
    expect(screen.getByText("name").closest("th")).toHaveClass("cursor-pointer");
  });

  it("does not show sort controls when onSort is not provided", () => {
    const hg = makeHeaderGroup([{ id: "name", type: "STRING" }]);

    render(
      <table>
        <DataTableHeader headerGroups={hg} />
      </table>,
    );

    expect(screen.getByText("name").closest("th")).not.toHaveClass("cursor-pointer");
  });
});

describe("DataTableRows", () => {
  it("shows 'No results found' when rows is empty", () => {
    render(
      <table>
        <tbody>
          <DataTableRows rows={[]} columnCount={3} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("dataTable.noResults")).toBeInTheDocument();
  });

  it("renders one row per data entry with correct selection state", () => {
    const rows = [
      {
        id: "r1",
        original: { id: "r1" },
        getIsSelected: () => false,
        getVisibleCells: () => [
          {
            id: "c1",
            column: { columnDef: { size: 100, cell: "Cell A" } },
            getContext: () => ({}),
          },
        ],
      },
      {
        id: "r2",
        original: { id: "r2" },
        getIsSelected: () => true,
        getVisibleCells: () => [
          {
            id: "c2",
            column: { columnDef: { size: 100, cell: "Cell B" } },
            getContext: () => ({}),
          },
        ],
      },
    ] as unknown as Row<Record<string, unknown>>[];

    render(
      <table>
        <tbody>
          <DataTableRows rows={rows} columnCount={1} />
        </tbody>
      </table>,
    );

    const tableRows = screen.getAllByRole("row");
    expect(tableRows).toHaveLength(2);
    expect(tableRows[0]).toHaveAttribute("data-state", "false");
    expect(tableRows[1]).toHaveAttribute("data-state", "selected");

    expect(screen.getByText("Cell A")).toBeInTheDocument();
    expect(screen.getByText("Cell B")).toBeInTheDocument();
  });
});
