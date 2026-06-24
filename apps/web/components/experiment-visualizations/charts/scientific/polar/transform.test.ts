import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformPolarData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(
  role: ExperimentDataSourceConfig["role"],
  columnName: string,
): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformPolarData", () => {
  it("returns empty when theta or Y is missing", () => {
    expect(transformPolarData([{ a: 1 }], [], baseConfig)).toEqual([]);
    expect(transformPolarData([{ a: 1 }], [ds("x", "a")], baseConfig)).toEqual([]);
  });

  it("returns empty on empty rows", () => {
    const sources = [ds("x", "t"), ds("y", "r")];
    expect(transformPolarData([], sources, baseConfig)).toEqual([]);
  });

  it("emits one trace per Y series without color split", () => {
    const sources = [ds("x", "t"), ds("y", "r")];
    const rows = [
      { t: 0, r: 1 },
      { t: 90, r: 2 },
      { t: 180, r: 3 },
    ];
    const result = transformPolarData(rows, sources, baseConfig);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("r");
  });

  it("sorts numeric theta ascending so polar lines render as a continuous arc", () => {
    const sources = [ds("x", "t"), ds("y", "r")];
    const rows = [
      { t: 270, r: 4 },
      { t: 0, r: 1 },
      { t: 180, r: 3 },
      { t: 90, r: 2 },
    ];
    const result = transformPolarData(rows, sources, baseConfig);
    expect(result[0].theta).toEqual([0, 90, 180, 270]);
    expect(result[0].r).toEqual([1, 2, 3, 4]);
  });

  it("preserves insertion order when theta is categorical (strings)", () => {
    const sources = [ds("x", "t"), ds("y", "r")];
    const rows = [
      { t: "B", r: 1 },
      { t: "A", r: 2 },
      { t: "C", r: 3 },
    ];
    const result = transformPolarData(rows, sources, baseConfig);
    expect(result[0].theta).toEqual(["B", "A", "C"]);
    expect(result[0].r).toEqual([1, 2, 3]);
  });

  it("splits per category in categorical-color mode (one trace per cat × Y)", () => {
    const sources = [ds("x", "t"), ds("y", "r"), ds("color", "g")];
    const cfg: ChartFormConfig = { colorMode: "categorical" };
    const rows = [
      { t: 0, r: 1, g: "A" },
      { t: 90, r: 2, g: "B" },
      { t: 180, r: 3, g: "A" },
    ];
    const result = transformPolarData(rows, sources, cfg);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toEqual(["A", "B"]);
  });

  it("toggles fill via polarFill flag", () => {
    const sources = [ds("x", "t"), ds("y", "r")];
    const cfg: ChartFormConfig = { polarFill: true };
    const result = transformPolarData(
      [
        { t: 0, r: 1 },
        { t: 90, r: 2 },
      ],
      sources,
      cfg,
    );
    expect(result[0].fill).toBe("toself");

    const off = transformPolarData([{ t: 0, r: 1 }], sources, baseConfig);
    expect(off[0].fill).toBe("none");
  });

  it("defaults mode to 'markers'", () => {
    const sources = [ds("x", "t"), ds("y", "r")];
    const result = transformPolarData([{ t: 0, r: 1 }], sources, baseConfig);
    expect(result[0].mode).toBe("markers");
  });
});
