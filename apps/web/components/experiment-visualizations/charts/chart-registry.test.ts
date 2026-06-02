import { describe, it, expect } from "vitest";

import { getChartTypeDef, listChartTypes, listChartTypesByFamily } from "./chart-registry";

describe("chart-type registry", () => {
  it("returns the line definition for chartType=line", () => {
    const def = getChartTypeDef("line");
    expect(def.type).toBe("line");
    expect(def.family).toBe("basic");
    expect(typeof def.defaultConfig).toBe("function");
    expect(typeof def.defaultDataConfig).toBe("function");
  });

  it("returns the scatter definition for chartType=scatter", () => {
    const def = getChartTypeDef("scatter");
    expect(def.type).toBe("scatter");
    expect(def.family).toBe("basic");
  });

  it.each([
    ["bar", "basic"],
    ["area", "basic"],
    ["dot-plot", "basic"],
    ["lollipop", "basic"],
    ["bubble", "basic"],
    ["pie", "basic"],
    ["histogram", "statistical"],
    ["box-plot", "statistical"],
    ["violin-plot", "statistical"],
    ["density-plot", "statistical"],
    ["ridge-plot", "statistical"],
    ["histogram-2d", "statistical"],
    ["density-plot-2d", "statistical"],
    ["spc-control-chart", "statistical"],
    ["heatmap", "scientific"],
    ["contour", "scientific"],
    ["correlation-matrix", "scientific"],
    ["parallel-coordinates", "scientific"],
    ["radar", "scientific"],
    ["polar", "scientific"],
    ["wind-rose", "scientific"],
    ["ternary", "scientific"],
    ["alluvial", "scientific"],
    ["carpet", "scientific"],
  ] as const)("returns the %s definition under the %s family", (type, family) => {
    const def = getChartTypeDef(type);
    expect(def.type).toBe(type);
    expect(def.family).toBe(family);
  });

  it("listChartTypes returns only registered types", () => {
    const all = listChartTypes();
    const types = all.map((d) => d.type).sort();
    expect(types).toEqual([
      "alluvial",
      "area",
      "bar",
      "box-plot",
      "bubble",
      "carpet",
      "contour",
      "correlation-matrix",
      "density-plot",
      "density-plot-2d",
      "dot-plot",
      "heatmap",
      "histogram",
      "histogram-2d",
      "line",
      "lollipop",
      "parallel-coordinates",
      "pie",
      "polar",
      "radar",
      "ridge-plot",
      "scatter",
      "spc-control-chart",
      "ternary",
      "violin-plot",
      "wind-rose",
    ]);
  });

  it("listChartTypesByFamily groups registered types under their family", () => {
    const grouped = listChartTypesByFamily();
    expect(grouped.basic.map((d) => d.type).sort()).toEqual([
      "area",
      "bar",
      "bubble",
      "dot-plot",
      "line",
      "lollipop",
      "pie",
      "scatter",
    ]);
    expect(grouped.statistical.map((d) => d.type).sort()).toEqual([
      "box-plot",
      "density-plot",
      "density-plot-2d",
      "histogram",
      "histogram-2d",
      "ridge-plot",
      "spc-control-chart",
      "violin-plot",
    ]);
    expect(grouped.scientific.map((d) => d.type).sort()).toEqual([
      "alluvial",
      "carpet",
      "contour",
      "correlation-matrix",
      "heatmap",
      "parallel-coordinates",
      "polar",
      "radar",
      "ternary",
      "wind-rose",
    ]);
    expect(grouped["3d"]).toEqual([]);
  });

  it("line defaults expose required Plotly + line-specific fields", () => {
    const def = getChartTypeDef("line");
    const config = def.defaultConfig();
    expect(config.mode).toBe("lines");
    expect(config.line).toBeDefined();
    expect(config.showLegend).toBe(true);
  });

  it("scatter defaults expose marker + colorscale fields", () => {
    const def = getChartTypeDef("scatter");
    const config = def.defaultConfig();
    expect(config.mode).toBe("markers");
    expect(config.marker).toMatchObject({ size: 6, symbol: "circle" });
  });

  it("default data config seeds X and Y data sources", () => {
    const def = getChartTypeDef("line");
    const data = def.defaultDataConfig("readings");
    expect(data.tableName).toBe("readings");
    expect(data.dataSources.map((ds) => ds.role)).toEqual(["x", "y"]);
    expect(data.dataSources.every((ds) => ds.tableName === "readings")).toBe(true);
  });
});
