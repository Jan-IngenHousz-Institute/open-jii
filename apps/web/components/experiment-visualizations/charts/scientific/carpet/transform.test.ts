import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformCarpetData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(role: ExperimentDataSourceConfig["role"], columnName: string): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

const wellShaped = [
  { x: 1, y: 1, z: 10 },
  { x: 1, y: 2, z: 20 },
  { x: 2, y: 1, z: 30 },
  { x: 2, y: 2, z: 40 },
];

describe("transformCarpetData", () => {
  it("returns empty when X / Y / Z columns aren't all configured", () => {
    const result = transformCarpetData([{ a: 1 }], [ds("x", "a")], baseConfig);
    expect(result.carpetData).toEqual([]);
    expect(result.contourData).toEqual([]);
    expect(result.degenerateReason).toBeNull();
  });

  it("emits both carpet + contour traces on the happy path", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const result = transformCarpetData(wellShaped, sources, baseConfig);
    expect(result.degenerateReason).toBeNull();
    expect(result.carpetData).toHaveLength(1);
    expect(result.contourData).toHaveLength(1);
    // 2 x 2 grid: 4 expanded (a, b) pairs plus matching x/y for screen coords.
    expect(result.carpetData[0].a).toHaveLength(4);
    expect(result.carpetData[0].b).toHaveLength(4);
    expect(result.carpetData[0].x).toHaveLength(4);
    expect(result.carpetData[0].y).toHaveLength(4);
    expect(result.contourData[0].a).toEqual([1, 2]);
    expect(result.contourData[0].b).toEqual([1, 2]);
  });

  it("flags `sameColumnAxes` when X and Y point to the same column", () => {
    const sources: ExperimentDataSourceConfig[] = [
      { tableName: "t", columnName: "shared", role: "x" },
      { tableName: "t", columnName: "shared", role: "y" },
      { tableName: "t", columnName: "z", role: "z" },
    ];
    const result = transformCarpetData([{ shared: 1, z: 9 }], sources, baseConfig);
    expect(result.degenerateReason).toBe("sameColumnAxes");
  });

  it("flags `singleAxisValue` when one axis has fewer than 2 values", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const rows = [
      { x: 1, y: 1, z: 10 },
      { x: 1, y: 2, z: 20 },
    ];
    const result = transformCarpetData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBe("singleAxisValue");
  });

  it("flags `flatZ` when all Z values are identical", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const rows = wellShaped.map((r) => ({ ...r, z: 99 }));
    const result = transformCarpetData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBe("flatZ");
  });

  it("flags `sparseGrid` when filled density falls below 10%", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    // 11 distinct numeric X × 11 distinct numeric Y → 121 cells, only
    // 11 diagonals filled → 9.1%, below the 10% threshold.
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 11; i++) rows.push({ x: i, y: i + 100, z: i });
    const result = transformCarpetData(rows, sources, baseConfig);
    expect(result.degenerateReason).toBe("sparseGrid");
  });

  it("derives ncontours floor of 2", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const cfg: ChartFormConfig = { carpetNContours: 1 };
    const result = transformCarpetData(wellShaped, sources, cfg);
    expect(result.contourData[0].ncontours).toBe(2);
  });

  it("defaults coloring to 'fill', which sets showlines=false", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const result = transformCarpetData(wellShaped, sources, baseConfig);
    expect(result.contourData[0].contours?.coloring).toBe("fill");
    expect(result.contourData[0].contours?.showlines).toBe(false);
  });

  it("contourColoring='lines' enables showlines=true", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const cfg: ChartFormConfig = { carpetContourColoring: "lines" };
    const result = transformCarpetData(wellShaped, sources, cfg);
    expect(result.contourData[0].contours?.showlines).toBe(true);
  });

  it("forces showlines on when labels are requested so plotly can place them", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const cfg: ChartFormConfig = {
      carpetContourColoring: "fill",
      carpetShowContourLabels: true,
    };
    const result = transformCarpetData(wellShaped, sources, cfg);
    expect(result.contourData[0].contours?.showlines).toBe(true);
    expect(result.contourData[0].contours?.showlabels).toBe(true);
  });

  it("emits explicit contour start/end/size so plotly never enters autocontour", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const result = transformCarpetData(wellShaped, sources, baseConfig);
    const contours = result.contourData[0].contours;
    expect(typeof contours?.start).toBe("number");
    expect(typeof contours?.end).toBe("number");
    expect(typeof contours?.size).toBe("number");
    expect(contours?.start).toBeLessThan(contours?.end ?? 0);
    expect(contours?.size).toBeGreaterThan(0);
  });

  it("emits z as a [b][a]-shaped 2D matrix (plotly carpet/heatmap convention)", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const result = transformCarpetData(wellShaped, sources, baseConfig);
    const z = result.contourData[0].z;
    expect(z).toHaveLength(2);
    expect(z[0]).toHaveLength(2);
  });

  it("wires showGrid through to both a and b carpet axes", () => {
    const sources = [ds("x", "x"), ds("y", "y"), ds("z", "z")];
    const offResult = transformCarpetData(wellShaped, sources, { showGrid: false });
    expect(offResult.carpetData[0].aaxis?.showgrid).toBe(false);
    expect(offResult.carpetData[0].baxis?.showgrid).toBe(false);
    const onResult = transformCarpetData(wellShaped, sources, { showGrid: true });
    expect(onResult.carpetData[0].aaxis?.showgrid).toBe(true);
    expect(onResult.carpetData[0].baxis?.showgrid).toBe(true);
  });
});
