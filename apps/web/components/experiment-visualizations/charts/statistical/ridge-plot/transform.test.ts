import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformRidgePlotData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(
  role: ExperimentDataSourceConfig["role"],
  columnName: string,
): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformRidgePlotData", () => {
  it("returns empty when Y or color column is missing", () => {
    expect(transformRidgePlotData([{ a: 1 }], [], baseConfig)).toEqual({
      series: [],
      ticks: [],
    });
    expect(transformRidgePlotData([{ a: 1 }], [ds("y", "a")], baseConfig).series).toEqual([]);
  });

  it("returns empty on empty rows", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    expect(transformRidgePlotData([], sources, baseConfig).series).toEqual([]);
  });

  it("drops categories with fewer than 2 numeric values (KDE needs ≥ 2)", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const rows = [
      { v: 1, g: "A" }, // only 1 point, dropped
      { v: 2, g: "B" },
      { v: 3, g: "B" },
    ];
    const result = transformRidgePlotData(rows, sources, baseConfig);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].name).toBe("B");
  });

  it("emits one ridge per category with shared X grid (200 sample points)", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const rows = [
      { v: 1, g: "A" },
      { v: 2, g: "A" },
      { v: 3, g: "A" },
      { v: 1, g: "B" },
      { v: 2, g: "B" },
      { v: 3, g: "B" },
    ];
    const result = transformRidgePlotData(rows, sources, baseConfig);
    expect(result.series).toHaveLength(2);
    expect(result.series[0].xs).toHaveLength(200);
    expect(result.series[1].xs).toHaveLength(200);
    // Shared X grid across lanes.
    expect(result.series[0].xs).toEqual(result.series[1].xs);
  });

  it("sorts alphabetical by default", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const rows = [
      { v: 1, g: "Charlie" },
      { v: 2, g: "Charlie" },
      { v: 1, g: "Alpha" },
      { v: 2, g: "Alpha" },
      { v: 1, g: "Bravo" },
      { v: 2, g: "Bravo" },
    ];
    const result = transformRidgePlotData(rows, sources, baseConfig);
    expect(result.series.map((s) => s.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("sorts by mean ascending when ridgeSortOrder is 'mean'", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const cfg: ChartFormConfig = { ridgeSortOrder: "mean" };
    const rows = [
      { v: 100, g: "high" },
      { v: 110, g: "high" },
      { v: 1, g: "low" },
      { v: 2, g: "low" },
      { v: 50, g: "mid" },
      { v: 51, g: "mid" },
    ];
    const result = transformRidgePlotData(rows, sources, cfg);
    expect(result.series.map((s) => s.name)).toEqual(["low", "mid", "high"]);
  });

  it("sorts by median when ridgeSortOrder is 'median'", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const cfg: ChartFormConfig = { ridgeSortOrder: "median" };
    const rows = [
      { v: 1, g: "A" },
      { v: 1, g: "A" },
      { v: 10, g: "A" }, // median = 1
      { v: 5, g: "B" },
      { v: 5, g: "B" },
      { v: 5, g: "B" }, // median = 5
    ];
    const result = transformRidgePlotData(rows, sources, cfg);
    expect(result.series[0].name).toBe("A");
    expect(result.series[1].name).toBe("B");
  });

  it("sorts by count descending when ridgeSortOrder is 'count' (largest at bottom)", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const cfg: ChartFormConfig = { ridgeSortOrder: "count" };
    const rows = [
      { v: 1, g: "small" },
      { v: 2, g: "small" }, // count 2
      { v: 1, g: "big" },
      { v: 2, g: "big" },
      { v: 3, g: "big" },
      { v: 4, g: "big" }, // count 4
    ];
    const result = transformRidgePlotData(rows, sources, cfg);
    expect(result.series.map((s) => s.name)).toEqual(["big", "small"]);
  });

  it("emits one tick per ridge, integer-indexed at lane positions", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const rows = [
      { v: 1, g: "A" },
      { v: 2, g: "A" },
      { v: 1, g: "B" },
      { v: 2, g: "B" },
    ];
    const result = transformRidgePlotData(rows, sources, baseConfig);
    expect(result.ticks).toEqual([
      { value: 0, label: "A" },
      { value: 1, label: "B" },
    ]);
  });

  it("returns empty when all rows have non-numeric Y values", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const rows = [
      { v: "n/a", g: "A" },
      { v: "n/a", g: "B" },
    ];
    expect(transformRidgePlotData(rows, sources, baseConfig)).toEqual({ series: [], ticks: [] });
  });

  it("returns empty when every category has fewer than 2 numeric values", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const rows = [
      { v: 1, g: "A" },
      { v: 2, g: "B" },
      { v: 3, g: "C" },
    ];
    expect(transformRidgePlotData(rows, sources, baseConfig)).toEqual({ series: [], ticks: [] });
  });

  it("collapses null category values to '(none)' label", () => {
    const sources = [ds("y", "v"), ds("color", "g")];
    const rows = [
      { v: 1, g: null },
      { v: 2, g: null },
      { v: 3, g: "A" },
      { v: 4, g: "A" },
    ];
    const result = transformRidgePlotData(rows, sources, baseConfig);
    expect(result.series.map((s) => s.name)).toContain("(none)");
  });
});
