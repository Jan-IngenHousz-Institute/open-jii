import { describe, expect, it } from "vitest";

import { sortRowsByColumn } from "./row-order";

describe("sortRowsByColumn", () => {
  it("orders numbers and numeric strings together, ascending", () => {
    const rows = [{ x: "10" }, { x: 2 }, { x: "1.5" }, { x: 0 }];

    expect(sortRowsByColumn(rows, "x").map((row) => row.x)).toEqual([0, "1.5", 2, "10"]);
  });

  it("orders ISO timestamps and categories by code unit", () => {
    const rows = [
      { t: "2024-03-01T00:00:00Z" },
      { t: "2024-01-15T12:00:00Z" },
      { t: "2024-01-15T09:30:00Z" },
    ];

    expect(sortRowsByColumn(rows, "t").map((row) => row.t)).toEqual([
      "2024-01-15T09:30:00Z",
      "2024-01-15T12:00:00Z",
      "2024-03-01T00:00:00Z",
    ]);
    expect(sortRowsByColumn([{ c: "b" }, { c: "B" }, { c: "a" }], "c").map((row) => row.c)).toEqual(
      ["B", "a", "b"],
    );
  });

  it("puts nulls first and numbers before strings, like the warehouse", () => {
    const rows = [{ x: "beta" }, { x: 3 }, { x: null }, { x: undefined }, { x: "alpha" }];

    expect(sortRowsByColumn(rows, "x").map((row) => row.x)).toEqual([
      null,
      undefined,
      3,
      "alpha",
      "beta",
    ]);
  });

  it("is stable for equal keys and leaves the input untouched", () => {
    const rows = [
      { x: 1, id: "a" },
      { x: 0, id: "b" },
      { x: 1, id: "c" },
      { x: 0, id: "d" },
    ];
    const snapshot = [...rows];

    const sorted = sortRowsByColumn(rows, "x");

    expect(sorted.map((row) => row.id)).toEqual(["b", "d", "a", "c"]);
    expect(rows).toEqual(snapshot);
    expect(sorted[0]).toBe(rows[1]);
  });
});
