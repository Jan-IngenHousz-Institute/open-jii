import { describe, expect, it } from "vitest";

import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformContourData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: DataSourceConfig["role"], columnName: string): DataSourceConfig {
  return { tableName: "t", columnName, role };
}

const wellShaped = [
  { x: "a", y: "p", z: 1 },
  { x: "a", y: "q", z: 2 },
  { x: "b", y: "p", z: 3 },
  { x: "b", y: "q", z: 4 },
];

describe("transformContourData", () => {
  it("returns empty when X / Y / Z columns are not all configured", () => {
    const result = transformContourData([{ a: 1 }], [ds("x", "a")], baseConfig);
    expect(result.series).toEqual([]);
    expect(result.degenerateReason).toBeNull();
  });

  it("returns empty with no reason on an empty pivot", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const result = transformContourData([], sources, baseConfig);
    expect(result.series).toEqual([]);
    expect(result.degenerateReason).toBeNull();
  });

  it("emits a series for the happy path", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const result = transformContourData(wellShaped, sources, baseConfig);
    expect(result.degenerateReason).toBeNull();
    expect(result.series).toHaveLength(1);
    expect(result.series[0].x).toEqual(["a", "b"]);
    expect(result.series[0].y).toEqual(["p", "q"]);
  });

  it("flags `sameColumnAxes` when X and Y point to the same column", () => {
    const sources: DataSourceConfig[] = [
      { tableName: "t", columnName: "shared", role: "x" },
      { tableName: "t", columnName: "shared", role: "y" },
      { tableName: "t", columnName: "z", role: "z" },
    ];
    const result = transformContourData([{ shared: 1, z: 9 }], sources, baseConfig);
    expect(result.degenerateReason).toBe("sameColumnAxes");
  });

  it("flags `singleAxisValue` when one axis collapses to a single category", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const rows = [
      { x: "a", y: "p", z: 1 },
      { x: "a", y: "q", z: 2 },
    ];
    const result = transformContourData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBe("singleAxisValue");
  });

  it("flags `flatZ` when every Z is identical", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const rows = wellShaped.map((r) => ({ ...r, z: 7 }));
    const result = transformContourData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBe("flatZ");
  });

  it("flags `sparseGrid` below 10% density", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    // 11×11 = 121 cells, 11 filled = 9.1% (below the 10% threshold).
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 11; i++) rows.push({ x: `x${i}`, y: `y${i}`, z: i });
    const result = transformContourData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBe("sparseGrid");
  });

  it("maps ncontours <= 0 to autocontour mode", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const cfg: ChartFormConfig = { contourNcontours: 0 };
    const result = transformContourData(wellShaped, sources, cfg);
    expect(result.series[0].ncontours).toBeUndefined();
    expect(result.series[0].autocontour).toBe(true);
  });

  it("passes explicit ncontours through and disables autocontour", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const cfg: ChartFormConfig = { contourNcontours: 10 };
    const result = transformContourData(wellShaped, sources, cfg);
    expect(result.series[0].ncontours).toBe(10);
    expect(result.series[0].autocontour).toBe(false);
  });

  it("defaults coloring to 'fill' and showlines to true", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const result = transformContourData(wellShaped, sources, baseConfig);
    expect(result.series[0].contours?.coloring).toBe("fill");
    expect(result.series[0].contours?.showlines).toBe(true);
  });
});
