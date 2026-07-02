import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import type { ChartFormConfig } from "../../chart-config";
import { transformParallelCoordinatesData } from "./transform";

const baseConfig: ChartFormConfig = {};

function ds(
  role: ExperimentDataSourceConfig["role"],
  columnName: string,
): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformParallelCoordinatesData", () => {
  it("returns empty series with fewer than 2 axes", () => {
    const result = transformParallelCoordinatesData([{ a: 1 }], [ds("y", "a")], baseConfig);
    expect(result.series).toEqual([]);
    expect(result.axes).toEqual(["a"]);
  });

  it("returns empty series when rows is empty", () => {
    const result = transformParallelCoordinatesData([], [ds("y", "a"), ds("y", "b")], baseConfig);
    expect(result.series).toEqual([]);
  });

  it("dedupes repeated column picks so the same column doesn't yield a duplicate axis", () => {
    const rows = [{ a: 1, b: 2 }];
    const result = transformParallelCoordinatesData(
      rows,
      [ds("y", "a"), ds("y", "b"), ds("y", "b")],
      baseConfig,
    );
    expect(result.axes).toEqual(["a", "b"]);
    expect(result.series[0].dimensions).toHaveLength(2);
  });

  it("emits one dimension per axis with raw numeric values", () => {
    const rows = [
      { a: 22, b: 0.5 },
      { a: 24, b: 0.6 },
      { a: 21, b: 0.45 },
    ];
    const result = transformParallelCoordinatesData(rows, [ds("y", "a"), ds("y", "b")], baseConfig);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].dimensions).toEqual([
      { label: "a", values: [22, 24, 21] },
      { label: "b", values: [0.5, 0.6, 0.45] },
    ]);
  });

  it("coerces non-numeric values to NaN so the polyline shows a gap", () => {
    const rows = [
      { a: 22, b: "n/a" },
      { a: 24, b: 0.6 },
    ];
    const result = transformParallelCoordinatesData(rows, [ds("y", "a"), ds("y", "b")], baseConfig);
    const bValues = result.series[0].dimensions[1].values;
    expect(Number.isNaN(bValues[0])).toBe(true);
    expect(bValues[1]).toBe(0.6);
  });

  it("omits the color line.color when no color column is configured", () => {
    const result = transformParallelCoordinatesData(
      [{ a: 1, b: 2 }],
      [ds("y", "a"), ds("y", "b")],
      baseConfig,
    );
    expect(result.series[0].line?.color).toBeUndefined();
    expect(result.series[0].line?.showscale).toBe(false);
  });

  it("omits the color channel when the color source is present but unselected", () => {
    const result = transformParallelCoordinatesData(
      [{ a: 1, b: 2 }],
      [ds("y", "a"), ds("y", "b"), ds("color", "")],
      baseConfig,
    );
    expect(result.series[0].line?.color).toBeUndefined();
    expect(result.series[0].line?.showscale).toBe(false);
  });

  it("builds a continuous color channel from a numeric color column", () => {
    const rows = [
      { a: 1, b: 2, c: 0.1 },
      { a: 3, b: 4, c: 0.9 },
    ];
    const sources = [ds("y", "a"), ds("y", "b"), ds("color", "c")];
    const result = transformParallelCoordinatesData(rows, sources, baseConfig);
    expect(result.series[0].line?.color).toEqual([0.1, 0.9]);
    expect(result.series[0].line?.showscale).toBe(true);
  });

  it("synthesises a stepwise colorscale + tickvals/ticktext for categorical color", () => {
    const rows = [
      { a: 1, b: 2, g: "A" },
      { a: 3, b: 4, g: "B" },
      { a: 5, b: 6, g: "A" },
    ];
    const sources = [ds("y", "a"), ds("y", "b"), ds("color", "g")];
    const result = transformParallelCoordinatesData(rows, sources, { colorMode: "categorical" });
    expect(result.series[0].line?.color).toEqual([0, 1, 0]);
    expect(result.series[0].line?.cmin).toBe(0);
    expect(result.series[0].line?.cmax).toBe(1);
    expect(result.series[0].line?.colorbar?.ticktext).toEqual(["A", "B"]);
    expect(result.series[0].line?.colorbar?.tickvals).toEqual([0, 1]);
  });

  it("applies parcoordsLineWidth and parcoordsLineOpacity overrides", () => {
    const result = transformParallelCoordinatesData(
      [{ a: 1, b: 2 }],
      [ds("y", "a"), ds("y", "b")],
      { parcoordsLineWidth: 3, parcoordsLineOpacity: 0.8 },
    );
    expect(result.series[0].line?.width).toBe(3);
    expect(result.series[0].line?.opacity).toBe(0.8);
  });

  it("defaults line width to 1 and opacity to 0.5", () => {
    const result = transformParallelCoordinatesData(
      [{ a: 1, b: 2 }],
      [ds("y", "a"), ds("y", "b")],
      baseConfig,
    );
    expect(result.series[0].line?.width).toBe(1);
    expect(result.series[0].line?.opacity).toBe(0.5);
  });

  it("uses the color column as the colorbar title when no custom title is set", () => {
    const rows = [
      { a: 1, b: 2, c: 0.1 },
      { a: 3, b: 4, c: 0.9 },
    ];
    const sources = [ds("y", "a"), ds("y", "b"), ds("color", "c")];
    const result = transformParallelCoordinatesData(rows, sources, baseConfig);
    expect(result.series[0].line?.colorbar?.title?.text).toBe("c");
  });

  it("respects a custom marker.colorbar.title.text", () => {
    const rows = [
      { a: 1, b: 2, c: 0.1 },
      { a: 3, b: 4, c: 0.9 },
    ];
    const sources = [ds("y", "a"), ds("y", "b"), ds("color", "c")];
    const config: ChartFormConfig = {
      marker: { colorbar: { title: { text: "Probability" } } },
    };
    const result = transformParallelCoordinatesData(rows, sources, config);
    expect(result.series[0].line?.colorbar?.title?.text).toBe("Probability");
  });
});
