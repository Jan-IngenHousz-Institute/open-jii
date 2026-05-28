import { describe, expect, it } from "vitest";

import { pivotToMatrix } from "./pivot-to-matrix";

describe("pivotToMatrix", () => {
  it("returns empty categories and an empty matrix on an empty input", () => {
    const result = pivotToMatrix([], "x", "y", "z");
    expect(result.xCategories).toEqual([]);
    expect(result.yCategories).toEqual([]);
    expect(result.z).toEqual([]);
  });

  it("preserves first-seen order for both axes", () => {
    const rows = [
      { x: "b", y: 2, z: 10 },
      { x: "a", y: 1, z: 20 },
      { x: "b", y: 1, z: 30 },
    ];
    const result = pivotToMatrix(rows, "x", "y", "z");
    expect(result.xCategories).toEqual(["b", "a"]);
    expect(result.yCategories).toEqual([2, 1]);
  });

  it("emits z indexed as `z[yIndex][xIndex]`", () => {
    const rows = [
      { x: "a", y: "p", z: 1 },
      { x: "a", y: "q", z: 2 },
      { x: "b", y: "p", z: 3 },
      { x: "b", y: "q", z: 4 },
    ];
    const result = pivotToMatrix(rows, "x", "y", "z");
    const pi = result.yCategories.indexOf("p");
    const qi = result.yCategories.indexOf("q");
    const ai = result.xCategories.indexOf("a");
    const bi = result.xCategories.indexOf("b");
    expect(result.z[pi][ai]).toBe(1);
    expect(result.z[qi][ai]).toBe(2);
    expect(result.z[pi][bi]).toBe(3);
    expect(result.z[qi][bi]).toBe(4);
  });

  it("fills missing cells with NaN", () => {
    const rows = [{ x: "a", y: "p", z: 1 }];
    const result = pivotToMatrix([...rows, { x: "b", y: "q", z: 4 }], "x", "y", "z");
    // Cells (a, q) and (b, p) are absent — should be NaN, not 0 or undefined.
    const pi = result.yCategories.indexOf("p");
    const qi = result.yCategories.indexOf("q");
    const ai = result.xCategories.indexOf("a");
    const bi = result.xCategories.indexOf("b");
    expect(result.z[pi][ai]).toBe(1);
    expect(result.z[qi][bi]).toBe(4);
    expect(Number.isNaN(result.z[pi][bi])).toBe(true);
    expect(Number.isNaN(result.z[qi][ai])).toBe(true);
  });

  it("later (x, y) duplicates overwrite earlier ones (last-write-wins)", () => {
    const rows = [
      { x: "a", y: "p", z: 1 },
      { x: "a", y: "p", z: 99 },
    ];
    const result = pivotToMatrix(rows, "x", "y", "z");
    expect(result.z[0][0]).toBe(99);
  });

  it("drops rows where any of x / y / z is null or non-coercible", () => {
    const rows = [
      { x: "a", y: "p", z: 1 },
      { x: null, y: "p", z: 2 },
      { x: "b", y: null, z: 3 },
      { x: "c", y: "q", z: "not a number" },
    ];
    const result = pivotToMatrix(rows, "x", "y", "z");
    // Only the (a, p, 1) row survived. Note: "not a number" also gets
    // coerced through Number(), which yields NaN, so it's dropped.
    expect(result.xCategories).toEqual(["a"]);
    expect(result.yCategories).toEqual(["p"]);
    expect(result.z).toEqual([[1]]);
  });

  it("does not corrupt values containing the previous lossy `|` separator", () => {
    // The old shape stringified `${x}|${y}` and split back via
    // `split("|")`, which would mangle values containing the pipe.
    // After the rewrite, integer indices sidestep the string entirely.
    const rows = [
      { x: "a|b", y: "p|q", z: 7 },
      { x: "a", y: "b|p|q", z: 8 },
    ];
    const result = pivotToMatrix(rows, "x", "y", "z");
    expect(result.xCategories).toEqual(["a|b", "a"]);
    expect(result.yCategories).toEqual(["p|q", "b|p|q"]);
    expect(result.z[0][0]).toBe(7);
    expect(result.z[1][1]).toBe(8);
  });
});
