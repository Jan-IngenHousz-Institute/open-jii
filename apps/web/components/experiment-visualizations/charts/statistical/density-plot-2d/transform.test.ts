import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { transformDensityPlot2DData } from "./transform";

function ds(
  role: ExperimentDataSourceConfig["role"],
  columnName: string,
): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformDensityPlot2DData", () => {
  it("returns hasColumns=false when X or Y is missing", () => {
    expect(transformDensityPlot2DData([{ a: 1 }], [])).toEqual({
      x: [],
      y: [],
      hasColumns: false,
    });
    expect(transformDensityPlot2DData([{ a: 1 }], [ds("x", "a")]).hasColumns).toBe(false);
  });

  it("extracts paired numeric (x, y) tuples on the happy path", () => {
    const rows = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const sources = [ds("x", "x"), ds("y", "y")];
    const result = transformDensityPlot2DData(rows, sources);
    expect(result.hasColumns).toBe(true);
    expect(result.x).toEqual([1, 2, 3]);
    expect(result.y).toEqual([10, 20, 30]);
  });

  it("drops rows where either side isn't numeric", () => {
    const rows = [
      { x: 1, y: 10 },
      { x: "abc", y: 20 },
      { x: 3, y: null },
      { x: 4, y: 40 },
    ];
    const sources = [ds("x", "x"), ds("y", "y")];
    const result = transformDensityPlot2DData(rows, sources);
    expect(result.x).toEqual([1, 4]);
    expect(result.y).toEqual([10, 40]);
  });

  it("returns hasColumns=true with empty arrays when no rows pass", () => {
    const sources = [ds("x", "x"), ds("y", "y")];
    const result = transformDensityPlot2DData([{ x: "a", y: "b" }], sources);
    expect(result.hasColumns).toBe(true);
    expect(result.x).toEqual([]);
    expect(result.y).toEqual([]);
  });
});
