import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformHeatmapData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: ExperimentDataSourceConfig["role"], columnName: string): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformHeatmapData", () => {
  it("returns empty when X / Y / Z columns are not all configured", () => {
    const result = transformHeatmapData([{ a: 1 }], [ds("x", "a")], baseConfig);
    expect(result.series).toEqual([]);
    expect(result.degenerateReason).toBeNull();
  });

  it("returns empty with no reason on empty rows after pivot", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const result = transformHeatmapData([], sources, baseConfig);
    expect(result.series).toEqual([]);
    expect(result.degenerateReason).toBeNull();
  });

  it("emits a series for a happy-path filled grid", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const rows = [
      { x: "a", y: "p", z: 1 },
      { x: "a", y: "q", z: 2 },
      { x: "b", y: "p", z: 3 },
      { x: "b", y: "q", z: 4 },
    ];
    const result = transformHeatmapData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBeNull();
    expect(result.series).toHaveLength(1);
    expect(result.series[0].x).toEqual(["a", "b"]);
    expect(result.series[0].y).toEqual(["p", "q"]);
    expect(result.series[0].z).toHaveLength(2);
  });

  it("flags `sameColumnAxes` when X and Y point to the same column", () => {
    const sources: ExperimentDataSourceConfig[] = [
      { tableName: "t", columnName: "shared", role: "x" },
      { tableName: "t", columnName: "shared", role: "y" },
      { tableName: "t", columnName: "z", role: "z" },
    ];
    const result = transformHeatmapData([{ shared: 1, z: 9 }], sources, baseConfig);
    expect(result.series).toEqual([]);
    expect(result.degenerateReason).toBe("sameColumnAxes");
  });

  it("flags `singleAxisValue` when one axis has fewer than 2 unique values", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const rows = [
      { x: "a", y: "p", z: 1 },
      { x: "a", y: "q", z: 2 },
    ];
    const result = transformHeatmapData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBe("singleAxisValue");
  });

  it("flags `flatZ` when every Z value is identical", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const rows = [
      { x: "a", y: "p", z: 5 },
      { x: "a", y: "q", z: 5 },
      { x: "b", y: "p", z: 5 },
      { x: "b", y: "q", z: 5 },
    ];
    const result = transformHeatmapData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBe("flatZ");
  });

  it("flags `sparseGrid` when filled cell density falls below 10%", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    // 11 unique X × 11 unique Y → 121 cells, only the 11 diagonals filled
    // → 11/121 ≈ 9.1%, below the 10% threshold.
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 11; i++) {
      rows.push({ x: `x${i}`, y: `y${i}`, z: i });
    }
    const result = transformHeatmapData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBe("sparseGrid");
  });

  it("emits cell text when heatmapShowText is on, formatted to heatmapTextDecimals", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const rows = [
      { x: "a", y: "p", z: 1.2345 },
      { x: "a", y: "q", z: 2 },
      { x: "b", y: "p", z: 3 },
      { x: "b", y: "q", z: 4 },
    ];
    const cfg: ChartFormConfig = { heatmapShowText: true, heatmapTextDecimals: 1 };
    const result = transformHeatmapData(rows, sources, cfg);
    expect(result.series[0].text?.[0][0]).toBe("1.2");
    expect(result.series[0].texttemplate).toBe("%{text}");
  });

  it("maps zsmooth 'false' string to boolean false; passes 'best' through", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const rows = [
      { x: "a", y: "p", z: 1 },
      { x: "a", y: "q", z: 2 },
      { x: "b", y: "p", z: 3 },
      { x: "b", y: "q", z: 4 },
    ];
    const cfgFalse: ChartFormConfig = { heatmapZsmooth: "false" };
    const r1 = transformHeatmapData(rows, sources, cfgFalse);
    expect(r1.series[0].zsmooth).toBe(false);

    const cfgBest: ChartFormConfig = { heatmapZsmooth: "best" };
    const r2 = transformHeatmapData(rows, sources, cfgBest);
    expect(r2.series[0].zsmooth).toBe("best");
  });
});
