import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";

import type { DataRow } from "../../../../hooks/experiment/useExperimentData/useExperimentData";
import { projectAndOrderColumns } from "./loaded-table-columns";

function col(name: string, size?: number): AccessorKeyColumnDef<DataRow, unknown> {
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
