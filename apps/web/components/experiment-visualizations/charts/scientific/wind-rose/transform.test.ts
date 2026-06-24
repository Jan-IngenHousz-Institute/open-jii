import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformWindRoseData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(
  role: ExperimentDataSourceConfig["role"],
  columnName: string,
): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformWindRoseData", () => {
  it("returns empty when X or Y is missing", () => {
    expect(transformWindRoseData([{ a: 1 }], [], baseConfig)).toEqual({
      series: [],
      hasData: false,
    });
    expect(transformWindRoseData([{ a: 1 }], [ds("x", "a")], baseConfig).hasData).toBe(false);
  });

  it("returns empty when rows are empty", () => {
    const sources = [ds("x", "d"), ds("y", "m")];
    const result = transformWindRoseData([], sources, baseConfig);
    expect(result.hasData).toBe(false);
  });

  it("returns empty when no (dir, mag) numeric pairs survive coercion", () => {
    const sources = [ds("x", "d"), ds("y", "m")];
    const result = transformWindRoseData([{ d: "not-a-number", m: "nope" }], sources, baseConfig);
    expect(result.hasData).toBe(false);
  });

  it("emits one trace per value bin (windRoseValueBins)", () => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 16; i++) rows.push({ d: i * 22.5, m: i + 1 });
    const sources = [ds("x", "d"), ds("y", "m")];
    const cfg: ChartFormConfig = { windRoseValueBins: 4 };
    const result = transformWindRoseData(rows, sources, cfg);
    expect(result.hasData).toBe(true);
    expect(result.series).toHaveLength(4);
  });

  it("defaults to 8 direction bins, so each trace's r array has length 8", () => {
    const rows = [
      { d: 0, m: 1 },
      { d: 90, m: 2 },
      { d: 180, m: 3 },
      { d: 270, m: 4 },
    ];
    const sources = [ds("x", "d"), ds("y", "m")];
    const result = transformWindRoseData(rows, sources, baseConfig);
    expect(result.series[0].r).toHaveLength(8);
    expect(result.series[0].theta).toHaveLength(8);
  });

  it("wraps direction through mod 360 (-45 maps to the same petal as 315)", () => {
    const sources = [ds("x", "d"), ds("y", "m")];
    const rows = [
      { d: -45, m: 1 },
      { d: 315, m: 1 },
    ];
    const cfg: ChartFormConfig = { windRoseDirectionBins: 8, windRoseValueBins: 1 };
    const result = transformWindRoseData(rows, sources, cfg);
    // 8 bins, slice width 45°; 315° lands in petal 7. Both rows should
    // count into the same petal, count should be 2 there.
    const totalCount = result.series[0].r.reduce((s: number, v: number) => s + v, 0);
    expect(totalCount).toBe(2);
    expect(result.series[0].r[7]).toBe(2);
  });

  it("respects windRoseDirectionBins=16 (16 petals, slice width 22.5°)", () => {
    const rows = [{ d: 0, m: 1 }];
    const sources = [ds("x", "d"), ds("y", "m")];
    const cfg: ChartFormConfig = { windRoseDirectionBins: 16 };
    const result = transformWindRoseData(rows, sources, cfg);
    expect(result.series[0].r).toHaveLength(16);
    expect(result.series[0].width).toBe(360 / 16);
  });
});
