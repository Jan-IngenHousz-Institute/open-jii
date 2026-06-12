import type { CellContext } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

import type { DataColumn, DataFilter, ExperimentData } from "@repo/api/schemas/experiment.schema";

import type { DataRow } from "./data-table";
import {
  buildExperimentDataQuery,
  buildTableMetadata,
  compactFilters,
  createTableColumns,
  getColumnWidth,
  sortColumnsForDisplay,
} from "./data-table";

function col(name: string, typeText: string): DataColumn {
  return { name, type_name: typeText, type_text: typeText };
}

function cellContext(row: DataRow): CellContext<DataRow, unknown> {
  return {
    row: { getValue: (columnId: string) => row[columnId], original: row },
  } as unknown as CellContext<DataRow, unknown>;
}

describe("sortColumnsForDisplay", () => {
  it("pins the measurement-time columns first in their fixed order", () => {
    const sorted = sortColumnsForDisplay([
      col("value", "DOUBLE"),
      col("measurement_time_utc", "STRING"),
      col("local_time", "STRING"),
      col("measurement_time_local", "STRING"),
    ]);
    expect(sorted.map((c) => c.name)).toEqual([
      "measurement_time_local",
      "local_time",
      "measurement_time_utc",
      "value",
    ]);
  });

  it("groups remaining columns by type precedence", () => {
    const sorted = sortColumnsForDisplay([
      col("chart_data", "ARRAY<DOUBLE>"),
      col("struct_data", "ARRAY<STRUCT<name: STRING, age: INT>>"),
      col("id", "INT"),
      col("timestamp", "TIMESTAMP"),
      col("map_data", "MAP<STRING, STRING>"),
      col("name", "STRING"),
      col("other", "UNKNOWN"),
    ]);
    expect(sorted.map((c) => c.name)).toEqual([
      "timestamp",
      "struct_data",
      "map_data",
      "name",
      "id",
      "chart_data",
      "other",
    ]);
  });

  it("keeps the input order within a precedence group and does not mutate the input", () => {
    const columns = [col("b", "STRING"), col("a", "STRING"), col("ts", "TIMESTAMP")];
    const sorted = sortColumnsForDisplay(columns);
    expect(sorted.map((c) => c.name)).toEqual(["ts", "b", "a"]);
    expect(columns.map((c) => c.name)).toEqual(["b", "a", "ts"]);
  });
});

describe("getColumnWidth", () => {
  it("uses fixed widths for the time columns regardless of type", () => {
    expect(getColumnWidth("ARRAY", "measurement_time_local")).toBe(220);
    expect(getColumnWidth("STRING", "local_time")).toBe(90);
    expect(getColumnWidth("TIMESTAMP", "measurement_time_utc")).toBe(175);
  });

  it("sizes by type for other columns", () => {
    expect(getColumnWidth("MAP<STRING, INT>")).toBe(180);
    expect(getColumnWidth("ARRAY<STRUCT<name: STRING>>")).toBe(180);
    expect(getColumnWidth("VARIANT")).toBe(180);
    expect(getColumnWidth("ARRAY<DOUBLE>")).toBe(120);
    expect(getColumnWidth("STRING")).toBeUndefined();
    expect(getColumnWidth("INT")).toBeUndefined();
  });
});

describe("createTableColumns", () => {
  const data: ExperimentData = {
    columns: [col("name", "STRING"), col("timestamp", "TIMESTAMP"), col("chart", "ARRAY<DOUBLE>")],
    rows: [],
    totalRows: 0,
    truncated: false,
  };

  it("returns an empty array without data", () => {
    expect(createTableColumns({ data: undefined })).toEqual([]);
  });

  it("builds defs in display order with header, size and type meta", () => {
    const columns = createTableColumns({ data });
    expect(columns.map((c) => c.accessorKey)).toEqual(["timestamp", "name", "chart"]);
    expect(columns.map((c) => c.header)).toEqual(["timestamp", "name", "chart"]);
    expect(columns.map((c) => c.meta)).toEqual([
      { type: "TIMESTAMP" },
      { type: "STRING" },
      { type: "ARRAY<DOUBLE>" },
    ]);
    expect(columns.map((c) => c.size)).toEqual([undefined, undefined, 120]);
  });

  it("renders the raw value when no format function is given", () => {
    const [timestampDef] = createTableColumns({ data });
    const cell = timestampDef.cell as (ctx: CellContext<DataRow, unknown>) => unknown;
    expect(cell(cellContext({ id: "r1", timestamp: "2023-01-01" }))).toBe("2023-01-01");
  });

  it("forwards value, type, row id, column name and callbacks to the format function", () => {
    const calls: unknown[][] = [];
    const onChartClick = () => undefined;
    const isCellExpanded = () => false;
    const [timestampDef] = createTableColumns({
      data,
      formatFunction: (...args: unknown[]) => {
        calls.push(args);
        return "formatted";
      },
      onChartClick,
      isCellExpanded,
      errorColumn: "errors",
    });
    const cell = timestampDef.cell as (ctx: CellContext<DataRow, unknown>) => unknown;
    expect(cell(cellContext({ id: "r1", timestamp: "2023-01-01" }))).toBe("formatted");
    expect(calls).toEqual([
      [
        "2023-01-01",
        "TIMESTAMP",
        "r1",
        "timestamp",
        onChartClick,
        undefined,
        undefined,
        undefined,
        isCellExpanded,
        "errors",
      ],
    ]);
  });

  it("falls back to an empty row id when the row has none", () => {
    const calls: unknown[][] = [];
    const [timestampDef] = createTableColumns({
      data,
      formatFunction: (...args: unknown[]) => {
        calls.push(args);
        return "";
      },
    });
    const cell = timestampDef.cell as (ctx: CellContext<DataRow, unknown>) => unknown;
    cell(cellContext({ timestamp: "2023-01-01" }));
    expect(calls[0][2]).toBe("");
  });
});

describe("buildTableMetadata", () => {
  const data: ExperimentData = {
    columns: [col("name", "STRING"), col("timestamp", "TIMESTAMP")],
    rows: [],
    totalRows: 2,
    truncated: false,
  };

  it("returns undefined without a table", () => {
    expect(buildTableMetadata(undefined, {})).toBeUndefined();
  });

  it("builds columns, totals and display-ordered raw columns", () => {
    const metadata = buildTableMetadata(
      { data, totalPages: 5, totalRows: 100 },
      { errorColumn: "errors" },
    );
    expect(metadata?.totalPages).toBe(5);
    expect(metadata?.totalRows).toBe(100);
    expect(metadata?.errorColumn).toBe("errors");
    expect(metadata?.columns.map((c) => c.accessorKey)).toEqual(["timestamp", "name"]);
    expect(metadata?.rawColumns).toEqual([col("timestamp", "TIMESTAMP"), col("name", "STRING")]);
  });

  it("handles a table without data", () => {
    const metadata = buildTableMetadata({ totalPages: 0, totalRows: 0 }, {});
    expect(metadata).toEqual({
      columns: [],
      totalPages: 0,
      totalRows: 0,
      rawColumns: undefined,
      errorColumn: undefined,
    });
  });
});

describe("compactFilters", () => {
  const valid: DataFilter = { column: "name", operator: "equals", value: "x" };

  it("returns undefined for missing or empty input", () => {
    expect(compactFilters(undefined)).toBeUndefined();
    expect(compactFilters([])).toBeUndefined();
  });

  it("drops entries that fail validation", () => {
    const invalid = { column: "", operator: "equals", value: "x" } as DataFilter;
    expect(compactFilters([invalid, valid])).toEqual([valid]);
  });

  it("returns undefined when every entry is invalid", () => {
    const invalid = { column: "name", operator: "equals", value: "" } as DataFilter;
    expect(compactFilters([invalid])).toBeUndefined();
  });
});

describe("buildExperimentDataQuery", () => {
  const base = {
    experimentId: "exp-1",
    tableName: "raw_data",
    page: 2,
    pageSize: 25,
    orderBy: "timestamp",
    orderDirection: "DESC" as const,
  };

  it("keeps page and pageSize on the paginated path", () => {
    expect(buildExperimentDataQuery(base)).toEqual({
      query: {
        tableName: "raw_data",
        page: 2,
        pageSize: 25,
        orderBy: "timestamp",
        orderDirection: "DESC",
        filters: undefined,
      },
      queryKey: ["experiment", "exp-1", "raw_data", "timestamp", "DESC", undefined, 2, 25],
    });
  });

  it("strips page and pageSize and JSON-encodes filters on the filtered path", () => {
    const filters: DataFilter[] = [{ column: "name", operator: "equals", value: "x" }];
    const expectedJson = JSON.stringify(filters);
    expect(buildExperimentDataQuery({ ...base, filters })).toEqual({
      query: {
        tableName: "raw_data",
        page: undefined,
        pageSize: undefined,
        orderBy: "timestamp",
        orderDirection: "DESC",
        filters: expectedJson,
      },
      queryKey: ["experiment", "exp-1", "raw_data", "timestamp", "DESC", expectedJson],
    });
  });

  it("treats a filter set with no valid entries as unfiltered", () => {
    const invalid = { column: "", operator: "equals", value: "x" } as DataFilter;
    const plan = buildExperimentDataQuery({ ...base, filters: [invalid] });
    expect(plan.query.filters).toBeUndefined();
    expect(plan.query.page).toBe(2);
    expect(plan.queryKey).toContain(25);
  });
});
