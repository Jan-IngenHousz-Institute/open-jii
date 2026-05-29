import { describe, expect, it } from "vitest";

import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformTernaryData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: DataSourceConfig["role"], columnName: string): DataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformTernaryData", () => {
  it("returns empty when any of A / B / C columns is missing", () => {
    const r1 = transformTernaryData([{ a: 1, b: 2 }], [ds("x", "a"), ds("y", "b")], baseConfig);
    expect(r1.series).toEqual([]);
    expect(r1.cColumn).toBeUndefined();
  });

  it("returns empty on empty rows", () => {
    const sources = [ds("x", "a"), ds("y", "b"), ds("z", "c")];
    const result = transformTernaryData([], sources, baseConfig);
    expect(result.series).toEqual([]);
  });

  it("emits a single trace with (a, b, c) arrays on the happy path", () => {
    const sources = [ds("x", "a"), ds("y", "b"), ds("z", "c")];
    const rows = [
      { a: 30, b: 50, c: 20 },
      { a: 10, b: 60, c: 30 },
    ];
    const result = transformTernaryData(rows, sources, baseConfig);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].a).toEqual([30, 10]);
    expect(result.series[0].b).toEqual([50, 60]);
    expect(result.series[0].c).toEqual([20, 30]);
  });

  it("drops the (0, 0, 0) composition", () => {
    const sources = [ds("x", "a"), ds("y", "b"), ds("z", "c")];
    const rows = [
      { a: 0, b: 0, c: 0 },
      { a: 30, b: 50, c: 20 },
    ];
    const result = transformTernaryData(rows, sources, baseConfig);
    expect(result.series[0].a).toEqual([30]);
  });

  it("drops rows where any component is non-numeric", () => {
    const sources = [ds("x", "a"), ds("y", "b"), ds("z", "c")];
    const rows = [
      { a: "n/a", b: 1, c: 1 },
      { a: 1, b: null, c: 1 },
      { a: 30, b: 50, c: 20 },
    ];
    const result = transformTernaryData(rows, sources, baseConfig);
    expect(result.series[0].a).toEqual([30]);
  });

  it("splits into one trace per category in categorical-color mode", () => {
    const sources = [ds("x", "a"), ds("y", "b"), ds("z", "c"), ds("color", "g")];
    const cfg: ChartFormConfig = { colorMode: "categorical" };
    const rows = [
      { a: 10, b: 10, c: 10, g: "X" },
      { a: 20, b: 20, c: 20, g: "Y" },
      { a: 30, b: 30, c: 30, g: "X" },
    ];
    const result = transformTernaryData(rows, sources, cfg);
    expect(result.series).toHaveLength(2);
    expect(result.series.map((s) => s.name)).toEqual(["X", "Y"]);
    expect(result.series[0].a).toEqual([10, 30]);
    expect(result.series[1].a).toEqual([20]);
  });

  it("defaults ternarySum to 100", () => {
    const sources = [ds("x", "a"), ds("y", "b"), ds("z", "c")];
    const result = transformTernaryData([{ a: 1, b: 1, c: 1 }], sources, baseConfig);
    expect(result.series[0].sum).toBe(100);
  });

  it("respects ternarySum=1 for fractional compositions", () => {
    const sources = [ds("x", "a"), ds("y", "b"), ds("z", "c")];
    const cfg: ChartFormConfig = { ternarySum: 1 };
    const result = transformTernaryData([{ a: 0.5, b: 0.3, c: 0.2 }], sources, cfg);
    expect(result.series[0].sum).toBe(1);
  });
});
