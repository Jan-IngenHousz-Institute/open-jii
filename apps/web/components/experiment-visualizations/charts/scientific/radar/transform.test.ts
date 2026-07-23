import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformRadarData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(
  role: ExperimentDataSourceConfig["role"],
  columnName: string,
): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformRadarData", () => {
  it("returns empty when fewer than 3 Y columns are picked", () => {
    const sources = [ds("y", "a"), ds("y", "b")];
    const result = transformRadarData([{ a: 1, b: 2 }], sources, baseConfig);
    expect(result.series).toEqual([]);
    expect(result.categories).toEqual(["a", "b"]);
  });

  it("returns empty on empty rows even with 3+ Y columns", () => {
    const sources = [ds("y", "a"), ds("y", "b"), ds("y", "c")];
    const result = transformRadarData([], sources, baseConfig);
    expect(result.series).toEqual([]);
  });

  it("emits one polygon per row with the axis vertex closed", () => {
    const sources = [ds("y", "a"), ds("y", "b"), ds("y", "c")];
    const rows = [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 },
    ];
    const result = transformRadarData(rows, sources, baseConfig);
    expect(result.series).toHaveLength(2);
    // theta closed in degrees: [0, 120, 240, 0] for 3 evenly-spaced axes.
    expect(result.series[0].theta).toEqual([0, 120, 240, 0]);
    expect(result.series[0].r).toEqual([1, 2, 3, 1]);
  });

  it("uses 'Series N' naming when no color column is set", () => {
    const sources = [ds("y", "a"), ds("y", "b"), ds("y", "c")];
    const rows = [
      { a: 1, b: 1, c: 1 },
      { a: 2, b: 2, c: 2 },
    ];
    const result = transformRadarData(rows, sources, baseConfig);
    expect(result.series.map((s) => s.name)).toEqual(["Series 1", "Series 2"]);
  });

  it("labels polygons by category value when color column is set", () => {
    const sources = [ds("y", "a"), ds("y", "b"), ds("y", "c"), ds("color", "g")];
    const rows = [
      { a: 1, b: 1, c: 1, g: "X" },
      { a: 2, b: 2, c: 2, g: "Y" },
    ];
    const result = transformRadarData(rows, sources, baseConfig);
    expect(result.series.map((s) => s.name)).toEqual(["X", "Y"]);
  });

  it("returns categories matching the picked Y columns", () => {
    const sources = [ds("y", "rainfall"), ds("y", "ph"), ds("y", "nitrogen")];
    const result = transformRadarData([{ rainfall: 1, ph: 1, nitrogen: 1 }], sources, baseConfig);
    expect(result.categories).toEqual(["rainfall", "ph", "nitrogen"]);
  });

  it("toggles markers via radarShowMarkers", () => {
    const sources = [ds("y", "a"), ds("y", "b"), ds("y", "c")];
    const off = transformRadarData([{ a: 1, b: 1, c: 1 }], sources, baseConfig);
    expect(off.series[0].mode).toBe("lines");
    expect(off.series[0].marker).toBeUndefined();

    const cfg: ChartFormConfig = { radarShowMarkers: true };
    const on = transformRadarData([{ a: 1, b: 1, c: 1 }], sources, cfg);
    expect(on.series[0].mode).toBe("lines+markers");
    expect(on.series[0].marker).toBeDefined();
  });

  it("respects radarFill=false (no fill, no fillcolor)", () => {
    const sources = [ds("y", "a"), ds("y", "b"), ds("y", "c")];
    const cfg: ChartFormConfig = { radarFill: false };
    const result = transformRadarData([{ a: 1, b: 1, c: 1 }], sources, cfg);
    expect(result.series[0].fill).toBe("none");
    expect(result.series[0].fillcolor).toBeUndefined();
  });
});
