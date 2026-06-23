import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformHistogram2DData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: ExperimentDataSourceConfig["role"], columnName: string): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformHistogram2DData", () => {
  it("returns empty when X or Y is missing", () => {
    expect(transformHistogram2DData([{ a: 1 }], [], baseConfig)).toEqual([]);
    expect(transformHistogram2DData([{ a: 1 }], [ds("x", "a")], baseConfig)).toEqual([]);
  });

  it("returns empty when no numeric (x, y) tuples survive", () => {
    const sources = [ds("x", "x"), ds("y", "y")];
    const result = transformHistogram2DData([{ x: "a", y: "b" }], sources, baseConfig);
    expect(result).toEqual([]);
  });

  it("emits one trace with paired numeric arrays", () => {
    const rows = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const sources = [ds("x", "x"), ds("y", "y")];
    const result = transformHistogram2DData(rows, sources, baseConfig);
    expect(result).toHaveLength(1);
    expect(result[0].x).toEqual([1, 2, 3]);
    expect(result[0].y).toEqual([10, 20, 30]);
  });

  it("drops rows where either side fails to coerce numeric", () => {
    const sources = [ds("x", "x"), ds("y", "y")];
    const rows = [
      { x: 1, y: 10 },
      { x: "n/a", y: 20 },
      { x: 3, y: null },
      { x: 4, y: 40 },
    ];
    const result = transformHistogram2DData(rows, sources, baseConfig);
    expect(result[0].x).toEqual([1, 4]);
    expect(result[0].y).toEqual([10, 40]);
  });

  it("maps nbinsX/nbinsY 0 to undefined (Plotly auto-bin)", () => {
    const rows = [{ x: 1, y: 2 }];
    const sources = [ds("x", "x"), ds("y", "y")];
    const cfg: ChartFormConfig = { hist2dNbinsX: 0, hist2dNbinsY: 0 };
    const result = transformHistogram2DData(rows, sources, cfg);
    expect(result[0].nbinsx).toBeUndefined();
    expect(result[0].nbinsy).toBeUndefined();
  });

  it("passes nbins through when positive", () => {
    const rows = [{ x: 1, y: 2 }];
    const sources = [ds("x", "x"), ds("y", "y")];
    const cfg: ChartFormConfig = { hist2dNbinsX: 20, hist2dNbinsY: 15 };
    const result = transformHistogram2DData(rows, sources, cfg);
    expect(result[0].nbinsx).toBe(20);
    expect(result[0].nbinsy).toBe(15);
  });
});
