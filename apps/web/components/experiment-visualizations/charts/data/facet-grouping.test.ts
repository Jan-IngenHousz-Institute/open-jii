import { describe, expect, it } from "vitest";

import type { ChartFormConfig } from "../chart-config";
import { buildFacetSeries } from "./facet-grouping";

const baseConfig: ChartFormConfig = {};

describe("buildFacetSeries", () => {
  it("emits a single bucket with empty axis IDs when facetColumn is unset", () => {
    const rows = [{ a: 1 }, { a: 2 }];
    const result = buildFacetSeries<{ count: number; xaxisId: string | undefined }>(
      { rows, facetColumn: undefined, colorColumn: undefined, chartConfig: baseConfig },
      ({ cellRows, xaxisId }) => [{ count: cellRows.length, xaxisId }],
    );
    expect(result.subplots).toBeUndefined();
    expect(result.chartSeries).toEqual([{ count: 2, xaxisId: undefined }]);
  });

  it("groups rows by facet column in first-seen order", () => {
    const rows = [{ f: "b" }, { f: "a" }, { f: "b" }, { f: "a" }];
    const result = buildFacetSeries<{ key: string; count: number; cellIndex: number }>(
      { rows, facetColumn: "f", colorColumn: undefined, chartConfig: baseConfig },
      ({ cellRows, cellIndex }) => {
        const f = cellRows[0]?.f;
        const key = typeof f === "string" ? f : "";
        return [{ key, count: cellRows.length, cellIndex }];
      },
    );
    expect(result.chartSeries).toEqual([
      { key: "b", count: 2, cellIndex: 0 },
      { key: "a", count: 2, cellIndex: 1 },
    ]);
  });

  it("stamps numbered axis IDs and hides legend past cell 0", () => {
    const rows = [{ f: "x" }, { f: "y" }, { f: "z" }];
    const result = buildFacetSeries<{
      xaxisId: string | undefined;
      showlegend: boolean | undefined;
    }>(
      { rows, facetColumn: "f", colorColumn: undefined, chartConfig: baseConfig },
      ({ xaxisId, showlegend }) => [{ xaxisId, showlegend }],
    );
    expect(result.chartSeries.map((s) => s.xaxisId)).toEqual(["x", "x2", "x3"]);
    expect(result.chartSeries.map((s) => s.showlegend)).toEqual([undefined, false, false]);
  });

  it("computes the global category list across rows sorted alphabetically", () => {
    // Alphabetical (not first-seen) so palette indices stay stable and
    // match the swatch order shown in the color-map picker.
    const rows = [{ c: "B" }, { c: "A" }, { c: "B" }, { c: "C" }];
    let captured: { keys: string[]; values: (string | number | null)[] } = {
      keys: [],
      values: [],
    };
    buildFacetSeries(
      { rows, facetColumn: undefined, colorColumn: "c", chartConfig: baseConfig },
      ({ globalCategoryKeys, globalCategoryValues }) => {
        captured = { keys: [...globalCategoryKeys], values: [...globalCategoryValues] };
        return [];
      },
    );
    expect(captured.keys).toEqual(["A", "B", "C"]);
    expect(captured.values).toEqual(["A", "B", "C"]);
  });

  it("maps null facet values to '(none)' label and empty-string key", () => {
    const rows = [{ f: null }, { f: "x" }];
    const result = buildFacetSeries<{ key: string }>(
      { rows, facetColumn: "f", colorColumn: undefined, chartConfig: baseConfig },
      () => [],
    );
    // The labels live on `subplots.cells`; verify the "(none)" mapping.
    expect(result.subplots?.cells.map((c) => c.title)).toEqual(["(none)", "x"]);
  });

  it("emits a subplots config when faceted", () => {
    const rows = [{ f: "a" }, { f: "b" }, { f: "c" }, { f: "d" }];
    const result = buildFacetSeries(
      { rows, facetColumn: "f", colorColumn: undefined, chartConfig: baseConfig },
      () => [],
    );
    // 4 cells → ceil(sqrt(4)) = 2 columns, 2 rows by default.
    expect(result.subplots?.rows).toBe(2);
    expect(result.subplots?.columns).toBe(2);
    expect(result.subplots?.cells.length).toBe(4);
  });

  it("respects an explicit facetColumns override", () => {
    const rows = [{ f: "a" }, { f: "b" }, { f: "c" }, { f: "d" }, { f: "e" }];
    const config: ChartFormConfig = { facetColumns: 3 };
    const result = buildFacetSeries(
      { rows, facetColumn: "f", colorColumn: undefined, chartConfig: config },
      () => [],
    );
    expect(result.subplots?.columns).toBe(3);
    expect(result.subplots?.rows).toBe(2); // ceil(5/3)
  });

  it("defaults shared-X / shared-Y / shared-titles to true and rowOrder to top-to-bottom", () => {
    const rows = [{ f: "a" }, { f: "b" }];
    const result = buildFacetSeries(
      { rows, facetColumn: "f", colorColumn: undefined, chartConfig: baseConfig },
      () => [],
    );
    expect(result.subplots?.sharedX).toBe(true);
    expect(result.subplots?.sharedY).toBe(true);
    expect(result.subplots?.sharedXTitle).toBe(true);
    expect(result.subplots?.sharedYTitle).toBe(true);
    expect(result.subplots?.roworder).toBe("top to bottom");
  });

  it("honours an explicit bottom-to-top facetRowOrder", () => {
    const rows = [{ f: "a" }, { f: "b" }];
    const config: ChartFormConfig = { facetRowOrder: "bottom-to-top" };
    const result = buildFacetSeries(
      { rows, facetColumn: "f", colorColumn: undefined, chartConfig: config },
      () => [],
    );
    expect(result.subplots?.roworder).toBe("bottom to top");
  });
});
