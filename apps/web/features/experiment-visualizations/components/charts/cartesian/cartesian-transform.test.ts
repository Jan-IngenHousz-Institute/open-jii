import { describe, expect, it } from "vitest";

import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";

import type { ChartFormConfig } from "../chart-config";
import { transformCartesianData } from "./cartesian-transform";
import type { CartesianTransformOptions } from "./cartesian-transform";

const baseConfig: ChartFormConfig = {};
const baseOptions: CartesianTransformOptions = {
  defaultTraceType: "scatter",
  supportsContinuousColor: false,
  supportsSize: false,
};

function ds(role: DataSourceConfig["role"], columnName: string): DataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformCartesianData", () => {
  it("returns empty when no Y sources", () => {
    const result = transformCartesianData([{ a: 1 }], [], baseConfig, baseOptions);
    expect(result.chartSeries).toEqual([]);
    expect(result.subplots).toBeUndefined();
    expect(result.useIndexForX).toBe(false);
  });

  it("synthesises X from row index when Y is set but X is not", () => {
    const rows = [{ v: 1 }, { v: 2 }, { v: 3 }];
    const result = transformCartesianData(rows, [ds("y", "v")], baseConfig, baseOptions);
    expect(result.useIndexForX).toBe(true);
    expect(result.chartSeries).toHaveLength(1);
    expect(result.chartSeries[0].x).toEqual([0, 1, 2]);
    expect(result.chartSeries[0].y).toEqual([1, 2, 3]);
  });

  it("uses X column when both axes are set", () => {
    const rows = [
      { x: 10, v: 1 },
      { x: 20, v: 2 },
    ];
    const sources = [ds("x", "x"), ds("y", "v")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.useIndexForX).toBe(false);
    expect(result.chartSeries[0].x).toEqual([10, 20]);
    expect(result.chartSeries[0].y).toEqual([1, 2]);
  });

  it("emits one trace per Y series without color split", () => {
    const rows = [
      { x: 1, a: 10, b: 100 },
      { x: 2, a: 20, b: 200 },
    ];
    const sources = [ds("x", "x"), ds("y", "a"), ds("y", "b")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries[0].name).toBe("a");
    expect(result.chartSeries[1].name).toBe("b");
  });

  it("emits one trace per (Y × category) on a categorical color split", () => {
    const rows = [
      { x: 1, v: 10, g: "A" },
      { x: 2, v: 20, g: "B" },
      { x: 3, v: 30, g: "A" },
      { x: 4, v: 40, g: "B" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "g")];
    const config: ChartFormConfig = { colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B"]);
    expect(result.chartSeries[0].x).toEqual([1, 3]);
    expect(result.chartSeries[1].x).toEqual([2, 4]);
  });

  it("emits 2 Y × 2 categories = 4 traces with `Y — category` names", () => {
    const rows = [
      { x: 1, a: 10, b: 100, g: "A" },
      { x: 2, a: 20, b: 200, g: "B" },
    ];
    const sources = [ds("x", "x"), ds("y", "a"), ds("y", "b"), ds("color", "g")];
    const config: ChartFormConfig = { colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.chartSeries).toHaveLength(4);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["a — A", "a — B", "b — A", "b — B"]);
  });

  it("uses continuous-color path when supportsContinuousColor and color column is numeric", () => {
    const rows = [
      { x: 1, v: 10, c: 0.1 },
      { x: 2, v: 20, c: 0.5 },
      { x: 3, v: 30, c: 0.9 },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "c")];
    const options = { ...baseOptions, supportsContinuousColor: true };
    const result = transformCartesianData(rows, sources, baseConfig, options);
    // Continuous: one trace per Y; the marker.color is the array of color values.
    expect(result.chartSeries).toHaveLength(1);
    expect(result.chartSeries[0].marker?.color).toEqual([0.1, 0.5, 0.9]);
  });

  it("builds subplots when facet column is set", () => {
    const rows = [
      { x: 1, v: 10, site: "A" },
      { x: 2, v: 20, site: "B" },
      { x: 3, v: 30, site: "A" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("facet", "site")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.subplots).toBeDefined();
    expect(result.subplots?.cells.map((c) => c.title)).toEqual(["A", "B"]);
    expect(result.chartSeries).toHaveLength(2);
  });

  it("respects facetColumns override", () => {
    const rows = [
      { v: 1, site: "a" },
      { v: 2, site: "b" },
      { v: 3, site: "c" },
      { v: 4, site: "d" },
      { v: 5, site: "e" },
    ];
    const sources = [ds("y", "v"), ds("facet", "site")];
    const config: ChartFormConfig = { facetColumns: 3 };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.subplots?.columns).toBe(3);
    expect(result.subplots?.rows).toBe(2);
  });

  it("defaults shared X / Y / titles to true on the subplot config", () => {
    const rows = [{ v: 1, site: "A" }];
    const sources = [ds("y", "v"), ds("facet", "site")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.subplots?.sharedX).toBe(true);
    expect(result.subplots?.sharedY).toBe(true);
    expect(result.subplots?.sharedXTitle).toBe(true);
    expect(result.subplots?.sharedYTitle).toBe(true);
  });

  it("flips roworder when facetRowOrder is bottom-to-top", () => {
    const rows = [
      { v: 1, site: "A" },
      { v: 2, site: "B" },
    ];
    const sources = [ds("y", "v"), ds("facet", "site")];
    const config: ChartFormConfig = { facetRowOrder: "bottom-to-top" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.subplots?.roworder).toBe("bottom to top");
  });
});
