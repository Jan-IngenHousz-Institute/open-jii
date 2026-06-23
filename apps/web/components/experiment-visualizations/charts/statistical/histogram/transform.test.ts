import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformHistogramData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: ExperimentDataSourceConfig["role"], columnName: string): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformHistogramData", () => {
  it("returns empty when no Y sources", () => {
    const result = transformHistogramData([{ a: 1 }], [], baseConfig);
    expect(result.chartSeries).toEqual([]);
    expect(result.subplots).toBeUndefined();
  });

  it("returns empty when rows are empty (one trace with empty values)", () => {
    const result = transformHistogramData([], [ds("y", "v")], baseConfig);
    expect(result.chartSeries).toHaveLength(1);
    expect(result.chartSeries[0].x).toEqual([]);
  });

  it("emits one trace per Y series without color split, vertical orientation", () => {
    const rows = [
      { a: 1, b: 10 },
      { a: 2, b: 20 },
      { a: 3, b: 30 },
    ];
    const sources = [ds("y", "a"), ds("y", "b")];
    const result = transformHistogramData(rows, sources, baseConfig);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries[0].name).toBe("a");
    expect(result.chartSeries[0].x).toEqual([1, 2, 3]);
    expect(result.chartSeries[0].y).toBeUndefined();
    expect(result.chartSeries[0].orientation).toBe("v");
    expect(result.chartSeries[1].x).toEqual([10, 20, 30]);
  });

  it("flips to y-axis when orientation is horizontal", () => {
    const rows = [{ v: 1 }, { v: 2 }];
    const config: ChartFormConfig = { histogramOrientation: "h" };
    const result = transformHistogramData(rows, [ds("y", "v")], config);
    expect(result.chartSeries[0].x).toBeUndefined();
    expect(result.chartSeries[0].y).toEqual([1, 2]);
    expect(result.chartSeries[0].orientation).toBe("h");
  });

  it("splits into one trace per category when color column is set", () => {
    const rows = [
      { v: 1, treatment: "A" },
      { v: 2, treatment: "B" },
      { v: 3, treatment: "A" },
    ];
    const sources = [ds("y", "v"), ds("color", "treatment")];
    const result = transformHistogramData(rows, sources, baseConfig);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B"]);
    expect(result.chartSeries[0].x).toEqual([1, 3]);
    expect(result.chartSeries[1].x).toEqual([2]);
  });

  it("preserves the user's histnorm when showNormalFit is on (fit scales to match)", () => {
    const rows = [{ v: 1 }, { v: 2 }];
    const config: ChartFormConfig = { showNormalFit: true, histnorm: "percent" };
    const result = transformHistogramData(rows, [ds("y", "v")], config);
    expect(result.chartSeries[0].histnorm).toBe("percent");
  });

  it("passes nbinsx through on vertical orientation, nbinsy on horizontal", () => {
    const rows = [{ v: 1 }];
    const configV: ChartFormConfig = { nbinsx: 12 };
    const resultV = transformHistogramData(rows, [ds("y", "v")], configV);
    expect(resultV.chartSeries[0].nbinsx).toBe(12);
    expect(resultV.chartSeries[0].nbinsy).toBeUndefined();

    const configH: ChartFormConfig = { nbinsx: 7, histogramOrientation: "h" };
    const resultH = transformHistogramData(rows, [ds("y", "v")], configH);
    expect(resultH.chartSeries[0].nbinsy).toBe(7);
    expect(resultH.chartSeries[0].nbinsx).toBeUndefined();
  });

  it("wraps cumulative flag in { enabled: true } when set", () => {
    const config: ChartFormConfig = { cumulative: true };
    const result = transformHistogramData([{ v: 1 }], [ds("y", "v")], config);
    expect(result.chartSeries[0].cumulative).toEqual({ enabled: true });
  });

  it("emits subplots when facet column is set", () => {
    const rows = [
      { v: 1, site: "X" },
      { v: 2, site: "Y" },
    ];
    const sources = [ds("y", "v"), ds("facet", "site")];
    const result = transformHistogramData(rows, sources, baseConfig);
    expect(result.subplots).toBeDefined();
    expect(result.subplots?.cells.map((c) => c.title)).toEqual(["X", "Y"]);
  });

  it("stamps bingroup per facet cell so categories share bin edges within a cell", () => {
    const rows = [
      { v: 1, g: "A", site: "X" },
      { v: 2, g: "B", site: "X" },
      { v: 3, g: "A", site: "Y" },
      { v: 4, g: "B", site: "Y" },
    ];
    const sources = [ds("y", "v"), ds("color", "g"), ds("facet", "site")];
    const result = transformHistogramData(rows, sources, baseConfig);
    const cellX = result.chartSeries.filter((s) => s.xaxisId === "x");
    const cellY = result.chartSeries.filter((s) => s.xaxisId === "x2");
    expect(new Set(cellX.map((s) => s.bingroup))).toHaveProperty("size", 1);
    expect(new Set(cellY.map((s) => s.bingroup))).toHaveProperty("size", 1);
    expect(cellX[0]?.bingroup).not.toEqual(cellY[0]?.bingroup);
  });
});
