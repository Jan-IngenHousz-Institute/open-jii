import { describe, it, expect, vi } from "vitest";

import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { createTableColumns, getColumnWidth, sortColumnsForDisplay } from "./data-table-columns";

describe("getColumnWidth", () => {
  it("should return 120 for ARRAY column type", () => {
    expect(getColumnWidth("ARRAY")).toBe(120);
  });

  it("should return 120 for ARRAY with generic type", () => {
    expect(getColumnWidth("ARRAY<STRING>")).toBe(120);
    expect(getColumnWidth("ARRAY<NUMBER>")).toBe(120);
    expect(getColumnWidth("ARRAY<INT>")).toBe(120);
  });

  it("should return 180 for MAP column type", () => {
    expect(getColumnWidth("MAP")).toBe(180);
  });

  it("should return 180 for MAP with STRING key type", () => {
    expect(getColumnWidth("MAP<STRING,")).toBe(180);
    expect(getColumnWidth("MAP<STRING,INT>")).toBe(180);
    expect(getColumnWidth("MAP<STRING,DOUBLE>")).toBe(180);
  });

  it("should return undefined for other column types", () => {
    expect(getColumnWidth("STRING")).toBeUndefined();
    expect(getColumnWidth("NUMBER")).toBeUndefined();
    expect(getColumnWidth("DOUBLE")).toBeUndefined();
    expect(getColumnWidth("INT")).toBeUndefined();
    expect(getColumnWidth("TIMESTAMP")).toBeUndefined();
    expect(getColumnWidth("BOOLEAN")).toBeUndefined();
    expect(getColumnWidth("ANNOTATIONS")).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(getColumnWidth("")).toBeUndefined();
  });

  it("should return 180 for MAP with STRING key and space", () => {
    expect(getColumnWidth("MAP<STRING, STRING>")).toBe(180);
    expect(getColumnWidth("MAP<STRING, INT>")).toBe(180);
  });

  it("should return 180 for ARRAY<STRUCT<...>> column type", () => {
    expect(getColumnWidth("ARRAY<STRUCT<question_label: STRING>>")).toBe(180);
    expect(getColumnWidth("ARRAY<STRUCT<name: STRING, age: INT>>")).toBe(180);
    expect(
      getColumnWidth(
        "ARRAY<STRUCT<question_label: STRING, question_text: STRING, question_answer: STRING>>",
      ),
    ).toBe(180);
  });

  it("should return 120 for other ARRAY types", () => {
    expect(getColumnWidth("ARRAY")).toBe(120);
    expect(getColumnWidth("ARRAY<DOUBLE>")).toBe(120);
    expect(getColumnWidth("ARRAY<STRING>")).toBe(120);
  });

  it("should return 180 for USER column type", () => {
    expect(getColumnWidth(WellKnownColumnTypes.CONTRIBUTOR)).toBe(180);
  });

  it("should return fixed widths for time columns by name", () => {
    expect(getColumnWidth("STRING", "measurement_time_local")).toBe(220);
    expect(getColumnWidth("STRING", "local_time")).toBe(90);
    expect(getColumnWidth("STRING", "measurement_time_utc")).toBe(175);
  });

  it("should prioritize column name over type for time columns", () => {
    expect(getColumnWidth("ARRAY", "measurement_time_local")).toBe(220);
    expect(getColumnWidth("MAP", "local_time")).toBe(90);
    expect(getColumnWidth("TIMESTAMP", "measurement_time_utc")).toBe(175);
  });
});

describe("sortColumnsForDisplay", () => {
  it("pins the measurement-time columns first, in their fixed order", () => {
    const ordered = sortColumnsForDisplay([
      { name: "phi2", type_name: "DOUBLE", type_text: "DOUBLE" },
      { name: "measurement_time_utc", type_name: "STRING", type_text: "STRING" },
      { name: "measurement_time_local", type_name: "STRING", type_text: "STRING" },
    ]);

    expect(ordered.map((column) => column.name)).toEqual([
      "measurement_time_local",
      "measurement_time_utc",
      "phi2",
    ]);
  });

  it("groups the rest by type, timestamps and variants ahead of numbers and arrays", () => {
    const ordered = sortColumnsForDisplay([
      { name: "spectrum", type_name: "ARRAY", type_text: "ARRAY<DOUBLE>" },
      { name: "phi2", type_name: "DOUBLE", type_text: "DOUBLE" },
      { name: "captured_at", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
      { name: "envelope", type_name: "VARIANT", type_text: "VARIANT" },
    ]);

    expect(ordered.map((column) => column.name)).toEqual([
      "captured_at",
      "envelope",
      "phi2",
      "spectrum",
    ]);
  });
});

describe("createTableColumns", () => {
  const COLUMNS = [
    { name: "phi2", type_name: "DOUBLE", type_text: "DOUBLE" },
    { name: "spectrum", type_name: "ARRAY", type_text: "ARRAY<DOUBLE>" },
  ];

  it("returns nothing to render when there are no columns", () => {
    expect(createTableColumns({ columns: undefined })).toEqual([]);
  });

  it("carries each column's DB type through to the cell renderer", () => {
    const formatFunction = vi.fn(() => "cell");
    const columns = createTableColumns({ columns: COLUMNS, formatFunction });

    expect(columns.map((column) => column.accessorKey)).toEqual(["phi2", "spectrum"]);
    expect(columns[0].meta).toEqual({ type: "DOUBLE" });
    // Arrays are narrower than the default, since they render as sparklines.
    expect(columns[1].size).toBe(120);
  });

  it("hands the formatter the value, its type and the row id", () => {
    const formatFunction = vi.fn(() => "cell");
    const [phi2Column] = createTableColumns({ columns: COLUMNS, formatFunction });
    const row = { getValue: () => 0.71, original: { id: "row-1" } };

    // @ts-expect-error tanstack passes a full cell context; the column only reads these two.
    phi2Column.cell?.({ row });

    expect(formatFunction).toHaveBeenCalledWith(
      0.71,
      "DOUBLE",
      "row-1",
      "phi2",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it("falls back to the raw value when no formatter is given", () => {
    const [phi2Column] = createTableColumns({ columns: COLUMNS });
    const row = { getValue: () => 0.71, original: { id: "row-1" } };

    // @ts-expect-error see above
    expect(phi2Column.cell?.({ row })).toBe(0.71);
  });
});
