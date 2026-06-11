import { describe, expect, it } from "vitest";

import { coerceCell } from "./cell-coercion";

describe("coerceCell", () => {
  it("returns numbers unchanged", () => {
    expect(coerceCell(42)).toBe(42);
    expect(coerceCell(0)).toBe(0);
    expect(coerceCell(-1.5)).toBe(-1.5);
  });

  it("parses numeric-looking strings into numbers", () => {
    expect(coerceCell("5.3")).toBe(5.3);
    expect(coerceCell("0")).toBe(0);
    expect(coerceCell("-12")).toBe(-12);
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(coerceCell("  3.14  ")).toBe(3.14);
  });

  it("keeps genuine label strings as strings", () => {
    expect(coerceCell("Add-on")).toBe("Add-on");
    expect(coerceCell("sensor-1")).toBe("sensor-1");
  });

  // `Number("") === 0`, but Plotly should see the cell as empty/missing,
  // not as a zero value that would distort axis ranges.
  it("preserves the empty string verbatim", () => {
    expect(coerceCell("")).toBe("");
  });

  it("coerces non-numeric strings that would yield NaN back to the original string", () => {
    expect(coerceCell("NaN")).toBe("NaN");
    expect(coerceCell("Infinity")).toBe("Infinity");
  });

  it("stringifies booleans and bigints; JSON-serialises objects", () => {
    expect(coerceCell(true)).toBe("true");
    expect(coerceCell(false)).toBe("false");
    expect(coerceCell({ a: 1 })).toBe('{"a":1}');
    expect(coerceCell([1, 2])).toBe("[1,2]");
  });

  // String("null") / String("undefined") would land in the data array
  // and force the axis into category mode with that string as a tick.
  it("returns null for null/undefined so Plotly skips the point", () => {
    expect(coerceCell(null)).toBe(null);
    expect(coerceCell(undefined)).toBe(null);
  });
});
