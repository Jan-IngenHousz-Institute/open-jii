import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import type { DataRow } from "~/components/data-table/data-table-columns";

import { projectAndOrderColumns, readColumnsFor } from "./loaded-table-columns";

function col(
  name: string,
  size?: number,
): AccessorKeyColumnDef<DataTableFeatures, DataRow, unknown> {
  return { accessorKey: name, ...(size !== undefined && { size }) };
}

describe("projectAndOrderColumns", () => {
  it("returns all columns in natural order when no selection is given", () => {
    const columns = [col("a"), col("b"), col("c")];
    const result = projectAndOrderColumns(columns, undefined);
    expect(result.map((c) => c.accessorKey)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array when selection is the empty list (intentional hide-all)", () => {
    const columns = [col("a"), col("b")];
    expect(projectAndOrderColumns(columns, [])).toEqual([]);
  });

  it("projects to the named subset and preserves the selection's order", () => {
    const columns = [col("a"), col("b"), col("c")];
    const result = projectAndOrderColumns(columns, ["c", "a"]);
    expect(result.map((c) => c.accessorKey)).toEqual(["c", "a"]);
  });

  it("ignores names in the selection that don't exist in the metadata", () => {
    const columns = [col("a"), col("b")];
    const result = projectAndOrderColumns(columns, ["a", "missing"]);
    expect(result.map((c) => c.accessorKey)).toEqual(["a"]);
  });

  it("caps wider columns at the max width but leaves narrower ones untouched", () => {
    const columns = [col("a", 50), col("b", 500), col("c")];
    const result = projectAndOrderColumns(columns, undefined);
    expect(result.map((c) => c.size)).toEqual([50, 120, 120]);
  });

  it("treats undefined metadata columns as an empty array", () => {
    expect(projectAndOrderColumns(undefined, undefined)).toEqual([]);
    expect(projectAndOrderColumns(undefined, ["a"])).toEqual([]);
  });
});

describe("readColumnsFor", () => {
  it("reads every column when no selection is given", () => {
    expect(readColumnsFor(undefined, "time", "error")).toBeUndefined();
    expect(readColumnsFor([], "time", "error")).toBeUndefined();
  });

  it("adds the sort, error and row id columns to the selection once", () => {
    expect(readColumnsFor(["a", "time", "id"], "time", "error")).toEqual([
      "a",
      "time",
      "id",
      "error",
    ]);
  });

  it("skips a sort or error column the table does not have", () => {
    expect(readColumnsFor(["a"], undefined, undefined)).toEqual(["a", "id"]);
  });
});
