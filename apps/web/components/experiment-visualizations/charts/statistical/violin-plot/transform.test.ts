import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformViolinPlotData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: ExperimentDataSourceConfig["role"], columnName: string): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformViolinPlotData", () => {
  it("returns empty when no Y sources", () => {
    const result = transformViolinPlotData([{ a: 1 }], [], baseConfig);
    expect(result.chartSeries).toEqual([]);
    expect(result.subplots).toBeUndefined();
  });

  it("emits one trace per Y series without color split", () => {
    const rows = [
      { temp: 22, humidity: 60 },
      { temp: 24, humidity: 55 },
    ];
    const sources = [ds("y", "temp"), ds("y", "humidity")];
    const result = transformViolinPlotData(rows, sources, baseConfig);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries[0].name).toBe("temp");
    expect(result.chartSeries[0].y).toEqual([22, 24]);
    expect(result.chartSeries[1].y).toEqual([60, 55]);
  });

  it("skips rows whose Y value isn't numeric", () => {
    const rows = [{ v: 1 }, { v: "n/a" }, { v: null }, { v: 5 }];
    const result = transformViolinPlotData(rows, [ds("y", "v")], baseConfig);
    expect(result.chartSeries[0].y).toEqual([1, 5]);
  });

  it("emits one trace per (Y × category) on a categorical color split", () => {
    const rows = [
      { v: 1, g: "A" },
      { v: 2, g: "B" },
      { v: 3, g: "A" },
    ];
    const sources = [ds("y", "v"), ds("color", "g")];
    const result = transformViolinPlotData(rows, sources, baseConfig);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B"]);
    expect(result.chartSeries[0].y).toEqual([1, 3]);
    expect(result.chartSeries[1].y).toEqual([2]);
  });

  it("flips x/y when orientation is horizontal", () => {
    const config: ChartFormConfig = { violinOrientation: "h" };
    const result = transformViolinPlotData([{ v: 1 }, { v: 2 }], [ds("y", "v")], config);
    expect(result.chartSeries[0].x).toEqual([1, 2]);
    expect(result.chartSeries[0].y).toBeUndefined();
  });

  it("maps points string 'false' to boolean false; passes 'outliers' through", () => {
    const cfgFalse: ChartFormConfig = { violinPoints: "false" };
    const r1 = transformViolinPlotData([{ v: 1 }], [ds("y", "v")], cfgFalse);
    expect(r1.chartSeries[0].points).toBe(false);

    const cfgAll: ChartFormConfig = { violinPoints: "all" };
    const r2 = transformViolinPlotData([{ v: 1 }], [ds("y", "v")], cfgAll);
    expect(r2.chartSeries[0].points).toBe("all");
  });

  it("defaults showBox to true and meanline to false, respects overrides", () => {
    const def = transformViolinPlotData([{ v: 1 }], [ds("y", "v")], baseConfig);
    expect(def.chartSeries[0].box).toEqual({ visible: true });
    expect(def.chartSeries[0].meanline).toEqual({ visible: false });

    const cfg: ChartFormConfig = { violinShowBox: false, violinShowMeanline: true };
    const result = transformViolinPlotData([{ v: 1 }], [ds("y", "v")], cfg);
    expect(result.chartSeries[0].box).toEqual({ visible: false });
    expect(result.chartSeries[0].meanline).toEqual({ visible: true });
  });

  it("emits subplots when facet column is set", () => {
    const rows = [
      { v: 1, site: "A" },
      { v: 2, site: "B" },
    ];
    const sources = [ds("y", "v"), ds("facet", "site")];
    const result = transformViolinPlotData(rows, sources, baseConfig);
    expect(result.subplots?.cells.map((c) => c.title)).toEqual(["A", "B"]);
    expect(result.chartSeries).toHaveLength(2);
  });
});
