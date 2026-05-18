import { describe, expect, it } from "vitest";

import { applyRowFilters } from "./data-filters";

describe("applyRowFilters", () => {
  const rows = [
    { school: "Lincoln", team: "Red", v: 1 },
    { school: "Lincoln", team: "Blue", v: 2 },
    { school: "Madison", team: "Red", v: 3 },
    { school: "Madison", team: "Blue", v: 4 },
    { school: null, team: "Red", v: 5 },
  ];

  it("returns rows unchanged when filters is undefined or empty", () => {
    expect(applyRowFilters(rows, undefined)).toEqual(rows);
    expect(applyRowFilters(rows, [])).toEqual(rows);
  });

  it("ignores half-configured filters (empty column or value)", () => {
    expect(applyRowFilters(rows, [{ column: "", operator: "equals", value: "Lincoln" }])).toEqual(
      rows,
    );
    expect(applyRowFilters(rows, [{ column: "school", operator: "equals", value: "" }])).toEqual(
      rows,
    );
  });

  it("keeps only rows matching every active filter (AND semantics)", () => {
    const out = applyRowFilters(rows, [{ column: "school", operator: "equals", value: "Lincoln" }]);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.school === "Lincoln")).toBe(true);

    const both = applyRowFilters(rows, [
      { column: "school", operator: "equals", value: "Madison" },
      { column: "team", operator: "equals", value: "Blue" },
    ]);
    expect(both).toEqual([{ school: "Madison", team: "Blue", v: 4 }]);
  });

  it("drops rows where the filtered cell is null", () => {
    const out = applyRowFilters(rows, [{ column: "school", operator: "equals", value: "Lincoln" }]);
    expect(out.some((r) => r.school === null)).toBe(false);
  });

  it("compares numeric, bigint, and boolean cells by their stringified form", () => {
    const numeric = [
      { plot: 81, v: 1 },
      { plot: 82, v: 2 },
      { plot: 81, v: 3 },
    ];
    expect(applyRowFilters(numeric, [{ column: "plot", operator: "equals", value: 81 }])).toEqual([
      { plot: 81, v: 1 },
      { plot: 81, v: 3 },
    ]);
    // Mixed numeric value/cell vs string value: same stringification.
    expect(applyRowFilters(numeric, [{ column: "plot", operator: "equals", value: "82" }])).toEqual(
      [{ plot: 82, v: 2 }],
    );

    const bigints = [{ id: BigInt(10) }, { id: BigInt(11) }];
    expect(
      applyRowFilters(bigints, [{ column: "id", operator: "equals", value: BigInt(10) }]),
    ).toEqual([{ id: BigInt(10) }]);

    const flags = [{ ok: true }, { ok: false }];
    expect(applyRowFilters(flags, [{ column: "ok", operator: "equals", value: true }])).toEqual([
      { ok: true },
    ]);
  });

  it("treats object / array cells as non-equal (no [object Object] collisions)", () => {
    const objects = [
      { meta: { foo: 1 }, v: 1 },
      { meta: { foo: 2 }, v: 2 },
    ];
    // Both rows' `meta` cells would stringify to "[object Object]"; the
    // filter must NOT collapse them — both should be dropped because the
    // comparison returns null for object cells.
    const out = applyRowFilters(objects, [
      { column: "meta", operator: "equals", value: { foo: 1 } },
    ]);
    expect(out).toEqual([]);
  });
});
