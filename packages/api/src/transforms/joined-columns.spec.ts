import { describe, expect, it } from "vitest";

import { isJoinMatchColumn, joinedColumns } from "./joined-columns";

const column = (name: string, type_text = "DOUBLE") => ({ name, type_text, type_name: type_text });

describe("joined columns", () => {
  it("allocates SQL-safe secondary keys without shadowing either table", () => {
    const columns = joinedColumns(
      [column("SECOND__temp"), column("second__temp_2")],
      [column("temp"), column("a.b"), column("a_b")],
      "weather",
    );
    expect(columns.map((c) => c.name)).toEqual(["second__temp_3", "second__a_b", "second__a_b_2"]);
    expect(columns[1].sourceTable).toEqual({ tableName: "weather", columnName: "a.b" });
  });
  it("only accepts known scalar match columns", () => {
    for (const type of ["STRING", "DOUBLE", "TIMESTAMP", "BOOLEAN"])
      expect(isJoinMatchColumn(column("key", type))).toBe(true);
    for (const type of ["VARIANT", "STRUCT<id: STRING, name: STRING, avatar: STRING>", "UNKNOWN"])
      expect(isJoinMatchColumn(column("key", type))).toBe(false);
  });
});
