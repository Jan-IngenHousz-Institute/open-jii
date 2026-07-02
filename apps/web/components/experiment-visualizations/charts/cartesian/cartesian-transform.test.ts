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

  it("sorts categorical color buckets alphabetically so palette indices stay stable", () => {
    const rows = [
      { x: 1, v: 10, g: "B" },
      { x: 2, v: 20, g: "A" },
      { x: 3, v: 30, g: "C" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "g")];
    const config: ChartFormConfig = { colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B", "C"]);
  });

  it("dedupes the legend across facet cells when each cell has a different category", () => {
    const rows = [
      { v: 1, g: "Arabidopsis", site: "A" },
      { v: 2, g: "Tomato", site: "B" },
    ];
    const sources = [ds("y", "v"), ds("color", "g"), ds("facet", "site")];
    const config: ChartFormConfig = { colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    const visibleInLegend = result.chartSeries.filter((s) => s.showlegend !== false);
    expect(visibleInLegend.map((s) => s.name).sort()).toEqual(["Arabidopsis", "Tomato"]);
  });

  it("stacks area traces with `stack-${axis}` so primary and secondary axes stack independently", () => {
    const rows = [
      { x: 1, a: 5, b: 50 },
      { x: 2, a: 10, b: 100 },
    ];
    const sources = [
      ds("x", "x"),
      { tableName: "t", columnName: "a", role: "y" } as DataSourceConfig,
      { tableName: "t", columnName: "b", role: "y", axis: "secondary" } as DataSourceConfig,
    ];
    const config: ChartFormConfig = { stackMode: "stacked" };
    const result = transformCartesianData(rows, sources, config, {
      ...baseOptions,
      defaultTraceType: "area",
    });
    expect(result.chartSeries.every((s) => s.stackgroup === undefined)).toBe(true);
    const primary = result.chartSeries.find((s) => s.axis !== "secondary");
    const secondary = result.chartSeries.find((s) => s.axis === "secondary");
    expect(primary?.fill).toBe("tozeroy");
    expect(secondary?.fill).toBe("tozeroy");
  });

  it("cumulates y values across categories within a stack group", () => {
    const rows = [
      { x: 1, v: 5, g: "A" },
      { x: 1, v: 7, g: "B" },
      { x: 2, v: 6, g: "A" },
      { x: 2, v: 9, g: "B" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "g")];
    const config: ChartFormConfig = { stackMode: "stacked", colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, {
      ...baseOptions,
      defaultTraceType: "area",
    });
    const a = result.chartSeries.find((s) => s.name === "A");
    const b = result.chartSeries.find((s) => s.name === "B");
    expect(a?.y).toEqual([5, 6]);
    expect(b?.y).toEqual([12, 15]);
  });

  it("normalises to percent when stackMode is 'percent'", () => {
    const rows = [
      { x: 1, v: 25, g: "A" },
      { x: 1, v: 75, g: "B" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "g")];
    const config: ChartFormConfig = { stackMode: "percent", colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, {
      ...baseOptions,
      defaultTraceType: "area",
    });
    const a = result.chartSeries.find((s) => s.name === "A");
    const b = result.chartSeries.find((s) => s.name === "B");
    expect(a?.y).toEqual([25]);
    expect(b?.y).toEqual([100]);
  });

  it("routes secondary-axis series onto per-cell overlay axes in facet mode", () => {
    const rows = [
      { x: 1, a: 10, b: 100, site: "X" },
      { x: 2, a: 20, b: 200, site: "Y" },
    ];
    const sources = [
      ds("x", "x"),
      { tableName: "t", columnName: "a", role: "y" } as DataSourceConfig,
      { tableName: "t", columnName: "b", role: "y", axis: "secondary" } as DataSourceConfig,
      ds("facet", "site"),
    ];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);

    // Two cells (X, Y) → primary axes y / y2; overlays live above the grid.
    expect(result.subplots?.cells.map((c) => c.secondaryYaxisId)).toEqual(["y3", "y4"]);

    const cellX = result.chartSeries.filter((s) => s.xaxisId === "x");
    const cellY = result.chartSeries.filter((s) => s.xaxisId === "x2");
    const primaryX = cellX.find((s) => s.axis !== "secondary");
    const secondaryX = cellX.find((s) => s.axis === "secondary");
    const secondaryY = cellY.find((s) => s.axis === "secondary");

    expect(primaryX?.yaxisId).toBe("y");
    expect(secondaryX?.yaxisId).toBe("y3");
    expect(secondaryY?.yaxisId).toBe("y4");
  });

  it("does not add overlay axes when no Y series targets the secondary axis", () => {
    const rows = [
      { x: 1, a: 10, site: "X" },
      { x: 2, a: 20, site: "Y" },
    ];
    const sources = [ds("x", "x"), ds("y", "a"), ds("facet", "site")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.subplots?.cells.every((c) => c.secondaryYaxisId === undefined)).toBe(true);
  });
});
