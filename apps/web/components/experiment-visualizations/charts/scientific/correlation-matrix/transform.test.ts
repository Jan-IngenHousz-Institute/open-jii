import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { aliasForCorrelationPair } from "../../data/correlation-alias";
import { transformCorrelationMatrixData } from "./transform";

function ds(
  role: ExperimentDataSourceConfig["role"],
  columnName: string,
): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformCorrelationMatrixData", () => {
  it("returns matrix=null when fewer than 2 distinct columns are picked", () => {
    expect(transformCorrelationMatrixData([], [])).toEqual({
      matrix: null,
      labels: [],
    });
    expect(transformCorrelationMatrixData([], [ds("y", "a")])).toEqual({
      matrix: null,
      labels: ["a"],
    });
  });

  it("dedupes repeated picks before checking the floor", () => {
    const result = transformCorrelationMatrixData([], [ds("y", "a"), ds("y", "a")]);
    expect(result.matrix).toBeNull();
    expect(result.labels).toEqual(["a"]);
  });

  it("returns matrix=null when rows are empty", () => {
    const result = transformCorrelationMatrixData([], [ds("y", "a"), ds("y", "b")]);
    expect(result.matrix).toBeNull();
    expect(result.labels).toEqual(["a", "b"]);
  });

  it("fills the diagonal with 1.0", () => {
    const aliasAB = aliasForCorrelationPair("a", "b");
    const row = { [aliasAB]: 0.5 };
    const result = transformCorrelationMatrixData([row], [ds("y", "a"), ds("y", "b")]);
    expect(result.matrix?.[0][0]).toBe(1);
    expect(result.matrix?.[1][1]).toBe(1);
  });

  it("reads off-diagonal symmetrically: both (a,b) and (b,a) hit the same alias", () => {
    const aliasAB = aliasForCorrelationPair("a", "b");
    const row = { [aliasAB]: 0.42 };
    const result = transformCorrelationMatrixData([row], [ds("y", "a"), ds("y", "b")]);
    expect(result.matrix?.[0][1]).toBe(0.42);
    expect(result.matrix?.[1][0]).toBe(0.42);
  });

  it("assembles a 3x3 matrix from the three pair aliases", () => {
    const row = {
      [aliasForCorrelationPair("a", "b")]: 0.1,
      [aliasForCorrelationPair("a", "c")]: 0.2,
      [aliasForCorrelationPair("b", "c")]: 0.3,
    };
    const result = transformCorrelationMatrixData(
      [row],
      [ds("y", "a"), ds("y", "b"), ds("y", "c")],
    );
    expect(result.matrix).toEqual([
      [1, 0.1, 0.2],
      [0.1, 1, 0.3],
      [0.2, 0.3, 1],
    ]);
  });

  it("coerces stringified numbers (Databricks decimal columns) to numbers", () => {
    const aliasAB = aliasForCorrelationPair("a", "b");
    const row = { [aliasAB]: "0.75" };
    const result = transformCorrelationMatrixData([row], [ds("y", "a"), ds("y", "b")]);
    expect(result.matrix?.[0][1]).toBe(0.75);
  });

  it("returns NaN at cells whose alias is missing or non-numeric", () => {
    const row = {};
    const result = transformCorrelationMatrixData([row], [ds("y", "a"), ds("y", "b")]);
    expect(Number.isNaN(result.matrix?.[0][1])).toBe(true);
  });
});
