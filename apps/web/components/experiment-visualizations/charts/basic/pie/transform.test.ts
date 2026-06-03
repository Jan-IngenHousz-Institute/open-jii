import { describe, expect, it } from "vitest";

import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { rowKeyForFunction } from "../../data/aggregation";
import { transformPieData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: DataSourceConfig["role"], columnName: string): DataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformPieData", () => {
  it("returns empty when labels or values column is missing", () => {
    expect(transformPieData([{ a: 1 }], [], undefined, baseConfig)).toEqual([]);
    expect(transformPieData([{ a: 1 }], [ds("labels", "a")], undefined, baseConfig)).toEqual([]);
  });

  it("returns empty when no rows survive", () => {
    const sources = [ds("labels", "lbl"), ds("values", "val")];
    const result = transformPieData([], sources, undefined, baseConfig);
    expect(result).toEqual([]);
  });

  it("renders rows row-by-row when no aggregation is configured (no client-side summing)", () => {
    // Aggregation is a server responsibility; the transform doesn't
    // collapse duplicate labels. `PieValuesShelf` writes the aggregation
    // entry on every column pick, so production configs always arrive
    // pre-aggregated; raw-row passthrough renders as-is.
    const rows = [
      { lbl: "A", val: 10 },
      { lbl: "B", val: 20 },
      { lbl: "A", val: 5 },
      { lbl: "C", val: 7 },
    ];
    const sources = [ds("labels", "lbl"), ds("values", "val")];
    const result = transformPieData(rows, sources, undefined, baseConfig);
    expect(result).toHaveLength(1);
    expect(result[0].labels).toEqual(["A", "B", "A", "C"]);
    expect(result[0].values).toEqual([10, 20, 5, 7]);
  });

  it("reads pre-aggregated rows via rowKeyForFunction when aggregation is configured", () => {
    const sources = [ds("labels", "lbl"), ds("values", "val")];
    const aggregation = {
      functions: [{ column: "val", function: "sum" as const }],
    };
    const alias = rowKeyForFunction(aggregation.functions[0]);
    const rows = [
      { lbl: "A", [alias]: 100 },
      { lbl: "B", [alias]: 50 },
    ];
    const result = transformPieData(rows, sources, aggregation, baseConfig);
    expect(result[0].labels).toEqual(["A", "B"]);
    expect(result[0].values).toEqual([100, 50]);
  });

  it("drops rows whose value coerces to NaN in either path", () => {
    const sources = [ds("labels", "lbl"), ds("values", "val")];
    const rows = [
      { lbl: "A", val: 1 },
      { lbl: "B", val: "not-a-number" },
      { lbl: "C", val: 3 },
    ];
    const result = transformPieData(rows, sources, undefined, baseConfig);
    expect(result[0].labels).toEqual(["A", "C"]);
    expect(result[0].values).toEqual([1, 3]);
  });

  it("derives one marker color per slice", () => {
    const sources = [ds("labels", "lbl"), ds("values", "val")];
    const rows = [
      { lbl: "A", val: 1 },
      { lbl: "B", val: 2 },
      { lbl: "C", val: 3 },
    ];
    const result = transformPieData(rows, sources, undefined, baseConfig);
    expect(result[0].marker?.colors).toHaveLength(3);
  });

  it("threads pie-specific style options through (hole, textinfo, textposition, sort)", () => {
    const sources = [ds("labels", "lbl"), ds("values", "val")];
    const cfg: ChartFormConfig = {
      hole: 0.5,
      textinfo: "label+percent",
      pieTextPosition: "outside",
      sortSlices: false,
    };
    const result = transformPieData([{ lbl: "A", val: 1 }], sources, undefined, cfg);
    expect(result[0].hole).toBe(0.5);
    expect(result[0].textinfo).toBe("label+percent");
    expect(result[0].textposition).toBe("outside");
    expect(result[0].sort).toBe(false);
  });
});
