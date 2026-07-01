import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformAlluvialData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(
  role: ExperimentDataSourceConfig["role"],
  columnName: string,
): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformAlluvialData", () => {
  it("returns empty when fewer than 2 stage columns are picked", () => {
    expect(transformAlluvialData([{ a: 1 }], [], baseConfig)).toEqual([]);
    expect(transformAlluvialData([{ a: "x" }], [ds("groupBy", "a")], baseConfig)).toEqual([]);
  });

  it("returns empty on empty rows", () => {
    const sources = [ds("groupBy", "s1"), ds("groupBy", "s2")];
    expect(transformAlluvialData([], sources, baseConfig)).toEqual([]);
  });

  it("emits a sankey trace with nodes per (stage_i, value) and links per (a→b)", () => {
    const sources = [ds("groupBy", "s1"), ds("groupBy", "s2")];
    const rows = [
      { s1: "A", s2: "X" },
      { s1: "A", s2: "Y" },
      { s1: "B", s2: "X" },
      { s1: "A", s2: "X" },
    ];
    const result = transformAlluvialData(rows, sources, baseConfig);
    expect(result).toHaveLength(1);
    // 2 stage-0 nodes (A, B) + 2 stage-1 nodes (X, Y) = 4 nodes.
    expect(result[0].nodes.label).toEqual(["A", "B", "X", "Y"]);
    // 3 distinct (a→b) pairs: A→X (count 2), A→Y (1), B→X (1).
    expect(result[0].links.source).toHaveLength(3);
    expect(result[0].links.value).toEqual([2, 1, 1]);
  });

  it("uses count-based link weights when no value column is set", () => {
    const sources = [ds("groupBy", "s1"), ds("groupBy", "s2")];
    const rows = [
      { s1: "A", s2: "X" },
      { s1: "A", s2: "X" },
      { s1: "A", s2: "X" },
    ];
    const result = transformAlluvialData(rows, sources, baseConfig);
    expect(result[0].links.value).toEqual([3]);
  });

  it("sums the value column when role:'value' is provided", () => {
    const sources = [ds("groupBy", "s1"), ds("groupBy", "s2"), ds("value", "w")];
    const rows = [
      { s1: "A", s2: "X", w: 10 },
      { s1: "A", s2: "X", w: 5 },
      { s1: "A", s2: "Y", w: 1 },
    ];
    const result = transformAlluvialData(rows, sources, baseConfig);
    expect(result[0].links.value).toEqual([15, 1]);
  });

  it("drops rows whose value is non-positive or non-numeric in 'value' mode", () => {
    const sources = [ds("groupBy", "s1"), ds("groupBy", "s2"), ds("value", "w")];
    const rows = [
      { s1: "A", s2: "X", w: 5 },
      { s1: "A", s2: "X", w: 0 },
      { s1: "A", s2: "X", w: -2 },
      { s1: "A", s2: "X", w: "n/a" },
    ];
    const result = transformAlluvialData(rows, sources, baseConfig);
    expect(result[0].links.value).toEqual([5]);
  });

  it("collapses null / empty stage values into a '(missing)' bucket", () => {
    const sources = [ds("groupBy", "s1"), ds("groupBy", "s2")];
    const rows = [
      { s1: null, s2: "X" },
      { s1: "", s2: "X" },
      { s1: "A", s2: "X" },
    ];
    const result = transformAlluvialData(rows, sources, baseConfig);
    expect(result[0].nodes.label).toContain("(missing)");
  });

  it("colorMode='stage' assigns one base color per stage column", () => {
    const sources = [ds("groupBy", "s1"), ds("groupBy", "s2")];
    const rows = [
      { s1: "A", s2: "X" },
      { s1: "B", s2: "X" },
    ];
    const cfg: ChartFormConfig = { alluvialColorMode: "stage" };
    const result = transformAlluvialData(rows, sources, cfg);
    // Two stage-0 nodes (A, B), same stage so same color. Stage 1 node X
    // gets a different color from stage 0.
    const colors = result[0].nodes.color;
    if (!colors) throw new Error("test setup invariant: colors defined");
    expect(colors[0]).toBe(colors[1]); // A and B (both stage 0)
    expect(colors[0]).not.toBe(colors[2]); // stage 0 vs stage 1
  });

  it("colorMode='value' assigns one color per unique node label", () => {
    const sources = [ds("groupBy", "s1"), ds("groupBy", "s2")];
    const rows = [
      { s1: "A", s2: "A" }, // same label "A" reused across stages
      { s1: "B", s2: "C" },
    ];
    const cfg: ChartFormConfig = { alluvialColorMode: "value" };
    const result = transformAlluvialData(rows, sources, cfg);
    const labels = result[0].nodes.label;
    const colors = result[0].nodes.color;
    if (!colors) throw new Error("test setup invariant: colors defined");
    // Find both "A" nodes; they should share a color in value mode.
    const aIndexes = labels.map((l, i) => (l === "A" ? i : -1)).filter((i) => i >= 0);
    expect(aIndexes).toHaveLength(2);
    expect(colors[aIndexes[0]]).toBe(colors[aIndexes[1]]);
  });

  it("hides node labels when alluvialHideLabels is true", () => {
    const sources = [ds("groupBy", "s1"), ds("groupBy", "s2")];
    const rows = [{ s1: "A", s2: "X" }];
    const cfg: ChartFormConfig = { alluvialHideLabels: true };
    const result = transformAlluvialData(rows, sources, cfg);
    expect(result[0].nodes.label).toEqual(["", ""]);
  });
});
