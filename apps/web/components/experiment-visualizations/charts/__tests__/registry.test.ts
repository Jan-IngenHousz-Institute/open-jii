import { describe, it, expect } from "vitest";

import {
  getChartTypeDef,
  isSupportedChartType,
  listChartTypes,
  listChartTypesByFamily,
} from "../registry";

describe("chart-type registry", () => {
  it("returns the line definition for chartType=line", () => {
    const def = getChartTypeDef("line");
    expect(def?.type).toBe("line");
    expect(def?.family).toBe("basic");
    expect(typeof def?.defaultConfig).toBe("function");
    expect(typeof def?.defaultDataConfig).toBe("function");
  });

  it("returns the scatter definition for chartType=scatter", () => {
    const def = getChartTypeDef("scatter");
    expect(def?.type).toBe("scatter");
    expect(def?.family).toBe("basic");
  });

  it("returns undefined for an unregistered chart type", () => {
    expect(getChartTypeDef("bar")).toBeUndefined();
    expect(isSupportedChartType("line")).toBe(true);
    expect(isSupportedChartType("bar")).toBe(false);
  });

  it("listChartTypes returns only registered types", () => {
    const all = listChartTypes();
    const types = all.map((d) => d.type).sort();
    expect(types).toEqual(["line", "scatter"]);
  });

  it("listChartTypesByFamily groups registered types under their family", () => {
    const grouped = listChartTypesByFamily();
    expect(grouped.basic.map((d) => d.type).sort()).toEqual(["line", "scatter"]);
    expect(grouped.scientific).toEqual([]);
    expect(grouped["3d"]).toEqual([]);
    expect(grouped.statistical).toEqual([]);
  });

  it("line defaults expose required Plotly + line-specific fields", () => {
    const def = getChartTypeDef("line");
    if (!def) throw new Error("line def missing from registry");
    const config = def.defaultConfig();
    expect(config.mode).toBe("lines");
    expect(config.showLegend).toBe(true);
    expect(config.line).toBeDefined();
  });

  it("scatter defaults expose marker + colorscale fields", () => {
    const def = getChartTypeDef("scatter");
    if (!def) throw new Error("scatter def missing from registry");
    const config = def.defaultConfig();
    expect(config.mode).toBe("markers");
    expect(config.marker).toMatchObject({ size: 6, symbol: "circle" });
  });

  it("default data config seeds X and Y data sources", () => {
    const def = getChartTypeDef("line");
    if (!def) throw new Error("line def missing from registry");
    const data = def.defaultDataConfig("readings");
    expect(data.tableName).toBe("readings");
    expect(data.dataSources.map((ds) => ds.role)).toEqual(["x", "y"]);
    expect(data.dataSources.every((ds) => ds.tableName === "readings")).toBe(true);
  });
});
