import { describe, expect, it } from "vitest";

import type { IndexedDataSource } from "../form-values";
import { buildXValues, coerceCell, resolveSeries } from "../series-helpers";

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

  it("preserves the empty string verbatim (returns the original empty value, not 0)", () => {
    // `Number("") === 0`, but Plotly should see the cell as empty/missing,
    // not as a zero value that would distort axis ranges.
    expect(coerceCell("")).toBe("");
  });

  it("coerces non-numeric strings that would yield NaN back to the original string", () => {
    expect(coerceCell("NaN")).toBe("NaN");
    expect(coerceCell("Infinity")).toBe("Infinity");
  });

  it("stringifies non-string, non-number values (booleans, null, objects)", () => {
    expect(coerceCell(true)).toBe("true");
    expect(coerceCell(false)).toBe("false");
    expect(coerceCell(null)).toBe("null");
    expect(coerceCell({ a: 1 })).toBe("[object Object]");
  });
});

describe("resolveSeries", () => {
  const ySource = (col: string, idx: number): IndexedDataSource => ({
    source: { tableName: "t", columnName: col, role: "y" },
    index: idx,
  });

  it("returns the configured Y entries when both X and Y are picked", () => {
    const yEntries = [ySource("temp", 1)];
    const result = resolveSeries(yEntries, "time");
    expect(result.effectiveYEntries).toBe(yEntries);
    expect(result.useIndexForX).toBe(false);
  });

  it("falls back to row-index X when Y is configured but X is missing", () => {
    const yEntries = [ySource("temp", 0)];
    const result = resolveSeries(yEntries, undefined);
    expect(result.effectiveYEntries).toBe(yEntries);
    expect(result.useIndexForX).toBe(true);
  });

  it("treats X as the single Y series when only X is configured", () => {
    const result = resolveSeries([], "time");
    expect(result.effectiveYEntries).toHaveLength(1);
    expect(result.effectiveYEntries[0]).toEqual({
      source: { tableName: "", columnName: "time", alias: "time", role: "y" },
      index: 0,
    });
    expect(result.useIndexForX).toBe(true);
  });

  it("returns no Y entries and no X fallback when nothing is configured", () => {
    const result = resolveSeries([], undefined);
    expect(result.effectiveYEntries).toEqual([]);
    expect(result.useIndexForX).toBe(false);
  });
});

describe("buildXValues", () => {
  it("returns row indices when useIndexForX is true", () => {
    const rows = [{ x: "a" }, { x: "b" }, { x: "c" }];
    expect(buildXValues(rows, "x", true)).toEqual([0, 1, 2]);
  });

  it("returns row indices when xColumn is undefined", () => {
    const rows = [{ x: "a" }, { x: "b" }];
    expect(buildXValues(rows, undefined, false)).toEqual([0, 1]);
  });

  it("coerces column values when xColumn is provided and useIndexForX is false", () => {
    const rows = [{ ts: "1.5" }, { ts: "2.0" }, { ts: "label" }];
    expect(buildXValues(rows, "ts", false)).toEqual([1.5, 2, "label"]);
  });

  it("returns an empty array for an empty rows input", () => {
    expect(buildXValues([], "x", false)).toEqual([]);
  });
});
