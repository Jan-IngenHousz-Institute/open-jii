import { describe, expect, it } from "vitest";

import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformBoxPlotData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: DataSourceConfig["role"], columnName: string): DataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformBoxPlotData", () => {
  it("returns empty when no Y sources", () => {
    const result = transformBoxPlotData([{ a: 1 }], [], baseConfig);
    expect(result.chartSeries).toEqual([]);
    expect(result.subplots).toBeUndefined();
  });

  it("emits one trace per Y series without color split", () => {
    const rows = [
      { temp: 22, humidity: 60 },
      { temp: 24, humidity: 55 },
    ];
    const sources = [ds("y", "temp"), ds("y", "humidity")];
    const result = transformBoxPlotData(rows, sources, baseConfig);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries[0].name).toBe("temp");
    expect(result.chartSeries[0].y).toEqual([22, 24]);
    expect(result.chartSeries[1].name).toBe("humidity");
    expect(result.chartSeries[1].y).toEqual([60, 55]);
  });

  it("skips rows whose Y value isn't numeric", () => {
    const rows = [{ temp: 22 }, { temp: "n/a" }, { temp: null }, { temp: 26 }];
    const result = transformBoxPlotData(rows, [ds("y", "temp")], baseConfig);
    expect(result.chartSeries[0].y).toEqual([22, 26]);
  });

  it("emits one trace per (Y × category) on a categorical color split", () => {
    const rows = [
      { temp: 22, treatment: "A" },
      { temp: 24, treatment: "B" },
      { temp: 26, treatment: "A" },
    ];
    const sources = [ds("y", "temp"), ds("color", "treatment")];
    const result = transformBoxPlotData(rows, sources, baseConfig);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B"]);
    expect(result.chartSeries[0].y).toEqual([22, 26]);
    expect(result.chartSeries[1].y).toEqual([24]);
  });

  it("emits a subplots config when facet column is set", () => {
    const rows = [
      { temp: 22, site: "X" },
      { temp: 24, site: "Y" },
    ];
    const sources = [ds("y", "temp"), ds("facet", "site")];
    const result = transformBoxPlotData(rows, sources, baseConfig);
    expect(result.subplots).toBeDefined();
    expect(result.subplots?.cells.map((c) => c.title)).toEqual(["X", "Y"]);
    expect(result.chartSeries).toHaveLength(2);
  });

  it("flips x/y when orientation is horizontal", () => {
    const rows = [{ v: 1 }, { v: 2 }];
    const config: ChartFormConfig = { boxOrientation: "h" };
    const result = transformBoxPlotData(rows, [ds("y", "v")], config);
    expect(result.chartSeries[0].x).toEqual([1, 2]);
    expect(result.chartSeries[0].y).toBeUndefined();
  });

  it("maps tri-state boxmean string to the wrapper's `boolean | 'sd'`", () => {
    const rows = [{ v: 1 }];
    const cases: { input: ChartFormConfig["boxmean"]; expected: boolean | "sd" }[] = [
      { input: "sd", expected: "sd" },
      { input: "true", expected: true },
      { input: "false", expected: false },
      { input: undefined, expected: false },
    ];
    for (const { input, expected } of cases) {
      const config: ChartFormConfig = { boxmean: input };
      const result = transformBoxPlotData(rows, [ds("y", "v")], config);
      expect(result.chartSeries[0].boxmean).toBe(expected);
    }
  });
});
