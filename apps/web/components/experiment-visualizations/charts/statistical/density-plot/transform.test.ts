import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformDensityPlotData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: ExperimentDataSourceConfig["role"], columnName: string): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformDensityPlotData", () => {
  it("returns empty when no Y sources", () => {
    const result = transformDensityPlotData([{ a: 1 }], [], baseConfig);
    expect(result.chartSeries).toEqual([]);
    expect(result.subplots).toBeUndefined();
  });

  it("drops series with fewer than 2 numeric values (KDE can't fit a single point)", () => {
    const rows = [{ v: 1 }];
    const result = transformDensityPlotData(rows, [ds("y", "v")], baseConfig);
    expect(result.chartSeries).toEqual([]);
  });

  it("emits one trace per Y series with KDE arrays when 2+ points", () => {
    const rows = [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }];
    const result = transformDensityPlotData(rows, [ds("y", "v")], baseConfig);
    expect(result.chartSeries).toHaveLength(1);
    expect(result.chartSeries[0].name).toBe("v");
    expect(result.chartSeries[0].mode).toBe("lines");
    // KDE samples 200 points across the range.
    expect(result.chartSeries[0].x).toHaveLength(200);
    expect(result.chartSeries[0].y).toHaveLength(200);
  });

  it("splits per category on a categorical color column", () => {
    const rows = [
      { v: 1, g: "A" },
      { v: 2, g: "A" },
      { v: 3, g: "B" },
      { v: 4, g: "B" },
      { v: 5, g: "A" },
    ];
    const sources = [ds("y", "v"), ds("color", "g")];
    const result = transformDensityPlotData(rows, sources, baseConfig);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B"]);
  });

  it("flips axes when orientation is horizontal", () => {
    const rows = [{ v: 1 }, { v: 2 }, { v: 3 }];
    const v = transformDensityPlotData(rows, [ds("y", "v")], baseConfig);
    const cfgH: ChartFormConfig = { densityOrientation: "h" };
    const h = transformDensityPlotData(rows, [ds("y", "v")], cfgH);
    // In vertical mode xs go on X; in horizontal mode they go on Y.
    expect(v.chartSeries[0].x[0]).not.toEqual(h.chartSeries[0].x[0]);
    expect(h.chartSeries[0].y).toEqual(v.chartSeries[0].x);
  });

  it("toggles fill via densityFill flag", () => {
    const rows = [{ v: 1 }, { v: 2 }];
    const off = transformDensityPlotData(rows, [ds("y", "v")], baseConfig);
    expect(off.chartSeries[0].fill).toBe("none");

    const cfgOn: ChartFormConfig = { densityFill: true };
    const on = transformDensityPlotData(rows, [ds("y", "v")], cfgOn);
    expect(on.chartSeries[0].fill).toBe("tozeroy");
  });

  it("emits subplots when facet column is set", () => {
    const rows = [
      { v: 1, site: "A" },
      { v: 2, site: "A" },
      { v: 3, site: "B" },
      { v: 4, site: "B" },
    ];
    const sources = [ds("y", "v"), ds("facet", "site")];
    const result = transformDensityPlotData(rows, sources, baseConfig);
    expect(result.subplots?.cells.map((c) => c.title)).toEqual(["A", "B"]);
  });

  it("shares the x-grid across cumulative CDFs so they line up over the same range", () => {
    const rows = [
      { v: 1, g: "X" },
      { v: 2, g: "X" },
      { v: 8, g: "Y" },
      { v: 9, g: "Y" },
    ];
    const sources = [ds("y", "v"), ds("color", "g")];
    const config: ChartFormConfig = { densityCumulative: true };
    const result = transformDensityPlotData(rows, sources, config);
    const xX = result.chartSeries[0]?.x ?? [];
    const xY = result.chartSeries[1]?.x ?? [];
    expect(xX.length).toBeGreaterThan(0);
    expect(xY).toEqual(xX);
  });
});
