import { describe, expect, it } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import type { ChartFormConfig } from "../chart-config";
import { transformCartesianData } from "./cartesian-transform";
import type { CartesianTransformOptions } from "./cartesian-transform";

const baseConfig: ChartFormConfig = {};
const baseOptions: CartesianTransformOptions = {
  defaultTraceType: "scatter",
  supportsContinuousColor: false,
  supportsSize: false,
};

function ds(
  role: ExperimentDataSourceConfig["role"],
  columnName: string,
): ExperimentDataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("transformCartesianData", () => {
  it("returns empty when no Y sources", () => {
    const result = transformCartesianData([{ a: 1 }], [], baseConfig, baseOptions);
    expect(result.chartSeries).toEqual([]);
    expect(result.subplots).toBeUndefined();
    expect(result.useIndexForX).toBe(false);
  });

  it("synthesises X from row index when Y is set but X is not", () => {
    const rows = [{ v: 1 }, { v: 2 }, { v: 3 }];
    const result = transformCartesianData(rows, [ds("y", "v")], baseConfig, baseOptions);
    expect(result.useIndexForX).toBe(true);
    expect(result.chartSeries).toHaveLength(1);
    expect(result.chartSeries[0].x).toEqual([0, 1, 2]);
    expect(result.chartSeries[0].y).toEqual([1, 2, 3]);
  });

  it("uses X column when both axes are set", () => {
    const rows = [
      { x: 10, v: 1 },
      { x: 20, v: 2 },
    ];
    const sources = [ds("x", "x"), ds("y", "v")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.useIndexForX).toBe(false);
    expect(result.chartSeries[0].x).toEqual([10, 20]);
    expect(result.chartSeries[0].y).toEqual([1, 2]);
  });

  it("emits one trace per Y series without color split", () => {
    const rows = [
      { x: 1, a: 10, b: 100 },
      { x: 2, a: 20, b: 200 },
    ];
    const sources = [ds("x", "x"), ds("y", "a"), ds("y", "b")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries[0].name).toBe("a");
    expect(result.chartSeries[1].name).toBe("b");
  });

  it("emits one trace per (Y x category) on a categorical color split", () => {
    const rows = [
      { x: 1, v: 10, g: "A" },
      { x: 2, v: 20, g: "B" },
      { x: 3, v: 30, g: "A" },
      { x: 4, v: 40, g: "B" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "g")];
    const config: ChartFormConfig = { colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B"]);
    expect(result.chartSeries[0].x).toEqual([1, 3]);
    expect(result.chartSeries[1].x).toEqual([2, 4]);
  });

  it("emits 2 Y x 2 categories = 4 traces with `Y — category` names", () => {
    const rows = [
      { x: 1, a: 10, b: 100, g: "A" },
      { x: 2, a: 20, b: 200, g: "B" },
    ];
    const sources = [ds("x", "x"), ds("y", "a"), ds("y", "b"), ds("color", "g")];
    const config: ChartFormConfig = { colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.chartSeries).toHaveLength(4);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["a — A", "a — B", "b — A", "b — B"]);
    // Every (series x category) combo shows in the legend; keying the
    // legendgroup on the series alone used to hide all but the first category.
    const visible = result.chartSeries.filter((s) => s.showlegend !== false).map((s) => s.name);
    expect(visible).toEqual(["a — A", "a — B", "b — A", "b — B"]);
  });

  it("uses continuous-color path when supportsContinuousColor and color column is numeric", () => {
    const rows = [
      { x: 1, v: 10, c: 0.1 },
      { x: 2, v: 20, c: 0.5 },
      { x: 3, v: 30, c: 0.9 },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "c")];
    const options = { ...baseOptions, supportsContinuousColor: true };
    const result = transformCartesianData(rows, sources, baseConfig, options);
    // Continuous: one trace per Y; the marker.color is the array of color values.
    expect(result.chartSeries).toHaveLength(1);
    expect(result.chartSeries[0].marker?.color).toEqual([0.1, 0.5, 0.9]);
  });

  it("uses one continuous colour scale across Y axes and facet cells", () => {
    const rows = [
      { x: 1, a: 10, b: 100, c: 0.1, site: "A" },
      { x: 2, a: 20, b: 200, c: 0.9, site: "B" },
    ];
    const sources = [
      ds("x", "x"),
      ds("y", "a"),
      { ...ds("y", "b"), axis: "secondary" as const },
      ds("color", "c"),
      ds("facet", "site"),
    ];
    const marker = {
      colorscale: "Viridis",
      showscale: true,
      colorbar: { title: { text: "Assay signal" } },
    };
    const options = { ...baseOptions, supportsContinuousColor: true };
    const result = transformCartesianData(rows, sources, { marker }, options);

    expect(result.colorAxis).toMatchObject(marker);
    expect(result.chartSeries.map((series) => series.marker?.color)).toEqual([
      [0.1],
      [0.1],
      [0.9],
      [0.9],
    ]);
    expect(result.chartSeries.every((series) => !series.marker?.showscale)).toBe(true);
    expect(
      transformCartesianData(rows, sources, { marker: { ...marker, showscale: false } }, options)
        .colorAxis,
    ).toMatchObject({ showscale: false });
  });

  it.each(["bar", "line", "area"] as const)(
    "keeps the shared scale as the only colour bar when a secondary series renders as %s",
    (traceType) => {
      const rows = [
        { x: 1, a: 10, b: 100, c: 0.1, site: "A" },
        { x: 2, a: 20, b: 200, c: 0.9, site: "B" },
      ];
      const sources = [
        ds("x", "x"),
        ds("y", "a"),
        { ...ds("y", "b"), axis: "secondary" as const, traceType },
        ds("color", "c"),
        ds("facet", "site"),
      ];
      const marker = {
        color: "purple",
        showscale: true,
        colorscale: "Viridis",
        colorbar: { title: { text: "Assay signal" } },
      };
      const { chartSeries, colorAxis } = transformCartesianData(
        rows,
        sources,
        { marker, mode: "lines+markers" },
        { ...baseOptions, supportsContinuousColor: true },
      );

      expect(colorAxis?.showscale).toBe(true);
      const secondary = chartSeries.filter((series) => series.traceType === traceType);
      expect(secondary).toHaveLength(2);
      for (const { marker } of secondary) {
        expect(marker?.color).toBe("purple");
        expect(marker?.showscale).toBe(false);
        expect(marker?.colorbar).toBeUndefined();
        expect(marker?.colorscale).toBeUndefined();
      }
    },
  );

  it("builds subplots when facet column is set", () => {
    const rows = [
      { x: 1, v: 10, site: "A" },
      { x: 2, v: 20, site: "B" },
      { x: 3, v: 30, site: "A" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("facet", "site")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.subplots).toBeDefined();
    expect(result.subplots?.cells.map((c) => c.title)).toEqual(["A", "B"]);
    expect(result.chartSeries).toHaveLength(2);
  });

  it("respects facetColumns override", () => {
    const rows = [
      { v: 1, site: "a" },
      { v: 2, site: "b" },
      { v: 3, site: "c" },
      { v: 4, site: "d" },
      { v: 5, site: "e" },
    ];
    const sources = [ds("y", "v"), ds("facet", "site")];
    const config: ChartFormConfig = { facetColumns: 3 };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.subplots?.columns).toBe(3);
    expect(result.subplots?.rows).toBe(2);
  });

  it("defaults shared X / Y / titles to true on the subplot config", () => {
    const rows = [{ v: 1, site: "A" }];
    const sources = [ds("y", "v"), ds("facet", "site")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.subplots?.sharedX).toBe(true);
    expect(result.subplots?.sharedY).toBe(true);
    expect(result.subplots?.sharedXTitle).toBe(true);
    expect(result.subplots?.sharedYTitle).toBe(true);
  });

  it("flips roworder when facetRowOrder is bottom-to-top", () => {
    const rows = [
      { v: 1, site: "A" },
      { v: 2, site: "B" },
    ];
    const sources = [ds("y", "v"), ds("facet", "site")];
    const config: ChartFormConfig = { facetRowOrder: "bottom-to-top" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.subplots?.roworder).toBe("bottom to top");
  });

  it("sorts categorical color buckets alphabetically so palette indices stay stable", () => {
    const rows = [
      { x: 1, v: 10, g: "B" },
      { x: 2, v: 20, g: "A" },
      { x: 3, v: 30, g: "C" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "g")];
    const config: ChartFormConfig = { colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B", "C"]);
  });

  it("dedupes the legend across facet cells when each cell has a different category", () => {
    const rows = [
      { v: 1, g: "Arabidopsis", site: "A" },
      { v: 2, g: "Tomato", site: "B" },
    ];
    const sources = [ds("y", "v"), ds("color", "g"), ds("facet", "site")];
    const config: ChartFormConfig = { colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    const visibleInLegend = result.chartSeries.filter((s) => s.showlegend !== false);
    expect(visibleInLegend.map((s) => s.name).sort()).toEqual(["Arabidopsis", "Tomato"]);
  });

  it("shows every (series x category) once across facet cells with multiple Y series", () => {
    const rows = [
      { a: 1, b: 10, g: "Students", region: "North" },
      { a: 2, b: 20, g: "Teachers", region: "North" },
      { a: 3, b: 30, g: "Students", region: "South" },
      { a: 4, b: 40, g: "Teachers", region: "South" },
    ];
    const sources = [ds("y", "a"), ds("y", "b"), ds("color", "g"), ds("facet", "region")];
    const config: ChartFormConfig = { colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, baseOptions);
    const visible = result.chartSeries.filter((s) => s.showlegend !== false).map((s) => s.name);
    // Both groups for both series, each exactly once (not collapsed to just Students).
    expect(visible.sort()).toEqual([
      "a — Students",
      "a — Teachers",
      "b — Students",
      "b — Teachers",
    ]);
  });

  it("stacks area traces with `stack-${axis}` so primary and secondary axes stack independently", () => {
    const rows = [
      { x: 1, a: 5, b: 50 },
      { x: 2, a: 10, b: 100 },
    ];
    const sources = [
      ds("x", "x"),
      { tableName: "t", columnName: "a", role: "y" } as ExperimentDataSourceConfig,
      {
        tableName: "t",
        columnName: "b",
        role: "y",
        axis: "secondary",
      } as ExperimentDataSourceConfig,
    ];
    const config: ChartFormConfig = { stackMode: "stacked" };
    const result = transformCartesianData(rows, sources, config, {
      ...baseOptions,
      defaultTraceType: "area",
    });
    expect(result.chartSeries.every((s) => s.stackgroup === undefined)).toBe(true);
    const primary = result.chartSeries.find((s) => s.axis !== "secondary");
    const secondary = result.chartSeries.find((s) => s.axis === "secondary");
    expect(primary?.fill).toBe("tozeroy");
    expect(secondary?.fill).toBe("tozeroy");
  });

  it("cumulates y values across categories within a stack group", () => {
    const rows = [
      { x: 1, v: 5, g: "A" },
      { x: 1, v: 7, g: "B" },
      { x: 2, v: 6, g: "A" },
      { x: 2, v: 9, g: "B" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "g")];
    const config: ChartFormConfig = { stackMode: "stacked", colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, {
      ...baseOptions,
      defaultTraceType: "area",
    });
    const a = result.chartSeries.find((s) => s.name === "A");
    const b = result.chartSeries.find((s) => s.name === "B");
    expect(a?.y).toEqual([5, 6]);
    expect(b?.y).toEqual([12, 15]);
  });

  it("normalises to percent when stackMode is 'percent'", () => {
    const rows = [
      { x: 1, v: 25, g: "A" },
      { x: 1, v: 75, g: "B" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "g")];
    const config: ChartFormConfig = { stackMode: "percent", colorMode: "categorical" };
    const result = transformCartesianData(rows, sources, config, {
      ...baseOptions,
      defaultTraceType: "area",
    });
    const a = result.chartSeries.find((s) => s.name === "A");
    const b = result.chartSeries.find((s) => s.name === "B");
    expect(a?.y).toEqual([25]);
    expect(b?.y).toEqual([100]);
  });

  it("groups each series across panels so one legend entry toggles all its traces", () => {
    const sources = [
      ds("x", "x"),
      ds("y", "one"),
      { ...ds("y", "two"), axis: "secondary" as const },
      ds("facet", "panel"),
    ];
    const data = [
      { x: 1, one: 2, two: 8, panel: "A" },
      { x: 2, one: 4, two: 6, panel: "B" },
    ];
    const { chartSeries } = transformCartesianData(data, sources, baseConfig, baseOptions);
    expect(chartSeries).toHaveLength(4);
    expect(chartSeries[0].legendgroup).toBeTruthy();
    expect(chartSeries[1].legendgroup).toBeTruthy();
    expect(chartSeries[0].legendgroup).not.toBe(chartSeries[1].legendgroup);
    expect(chartSeries[2].legendgroup).toBe(chartSeries[0].legendgroup);
    expect(chartSeries[3].legendgroup).toBe(chartSeries[1].legendgroup);
    expect(chartSeries.slice(2).map((series) => series.showlegend)).toEqual([false, false]);
  });

  it("routes secondary-axis series onto per-cell overlay axes in facet mode", () => {
    const rows = [
      { x: 1, a: 10, b: 100, site: "X" },
      { x: 2, a: 20, b: 200, site: "Y" },
    ];
    const sources = [
      ds("x", "x"),
      { tableName: "t", columnName: "a", role: "y" } as ExperimentDataSourceConfig,
      {
        tableName: "t",
        columnName: "b",
        role: "y",
        axis: "secondary",
      } as ExperimentDataSourceConfig,
      ds("facet", "site"),
    ];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);

    // Two cells (X, Y) → primary axes y / y2; overlays live above the grid.
    expect(result.subplots?.cells.map((c) => c.secondaryYaxisId)).toEqual(["y3", "y4"]);

    const cellX = result.chartSeries.filter((s) => s.xaxisId === "x");
    const cellY = result.chartSeries.filter((s) => s.xaxisId === "x2");
    const primaryX = cellX.find((s) => s.axis !== "secondary");
    const secondaryX = cellX.find((s) => s.axis === "secondary");
    const secondaryY = cellY.find((s) => s.axis === "secondary");

    expect(primaryX?.yaxisId).toBe("y");
    expect(secondaryX?.yaxisId).toBe("y3");
    expect(secondaryY?.yaxisId).toBe("y4");
  });

  it("does not add overlay axes when no Y series targets the secondary axis", () => {
    const rows = [
      { x: 1, a: 10, site: "X" },
      { x: 2, a: 20, site: "Y" },
    ];
    const sources = [ds("x", "x"), ds("y", "a"), ds("facet", "site")];
    const result = transformCartesianData(rows, sources, baseConfig, baseOptions);
    expect(result.subplots?.cells.every((c) => c.secondaryYaxisId === undefined)).toBe(true);
  });

  // Line, bar, area and dot-plot render their colour shelf `categoricalOnly`,
  // so they never write `config.colorMode`. The dispatch still sent them to
  // the categorical builder, but the global category list was gated on
  // `colorMode === "categorical"` and stayed empty, so every one of them
  // emitted zero series and drew a blank chart.
  it("pivots a colour column into categories when colorMode is unset", () => {
    const rows = [
      { x: 1, v: 10, dev: "A" },
      { x: 2, v: 20, dev: "B" },
      { x: 3, v: 30, dev: "A" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "dev")];

    const result = transformCartesianData(rows, sources, baseConfig, {
      ...baseOptions,
      defaultTraceType: "line",
    });

    expect(result.chartSeries).toHaveLength(2);
    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B"]);
    expect(result.chartSeries[0].y).toEqual([10, 30]);
    expect(result.chartSeries[1].y).toEqual([20]);
  });

  it("still honours an explicit categorical colorMode", () => {
    const rows = [
      { x: 1, v: 10, dev: "A" },
      { x: 2, v: 20, dev: "B" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "dev")];

    const result = transformCartesianData(
      rows,
      sources,
      { ...baseConfig, colorMode: "categorical" },
      { ...baseOptions, defaultTraceType: "line" },
    );

    expect(result.chartSeries.map((s) => s.name)).toEqual(["A", "B"]);
  });

  // Scatter and bubble are the only types that opt into continuous colour. With
  // no colorMode and no known column type, they keep the continuous default.
  it("keeps a single continuous-colour trace when the chart supports it", () => {
    const rows = [
      { x: 1, v: 10, temp: 5 },
      { x: 2, v: 20, temp: 9 },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "temp")];

    const result = transformCartesianData(rows, sources, baseConfig, {
      ...baseOptions,
      supportsContinuousColor: true,
    });

    expect(result.chartSeries).toHaveLength(1);
    expect(result.chartSeries[0].y).toEqual([10, 20]);
  });

  // Charts saved through the API may omit colorMode. The continuous builder
  // turned "WT" into NaN, which Plotly draws black, under one trace named
  // after the Y column.
  it("colours a text column by category when colorMode is unset", () => {
    const rows = [
      { x: 1, v: 10, genotype: "WT" },
      { x: 2, v: 20, genotype: "mutant" },
      { x: 3, v: 30, genotype: "WT" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "genotype")];

    const result = transformCartesianData(rows, sources, baseConfig, {
      ...baseOptions,
      supportsContinuousColor: true,
      colorColumnType: "STRING",
    });

    expect(result.chartSeries.find((s) => s.name === "WT")?.y).toEqual([10, 30]);
    expect(result.chartSeries.find((s) => s.name === "mutant")?.y).toEqual([20]);
  });

  // Plot numbers stored as text are labels, whatever their values look like.
  it("colours a text column of numbers by category", () => {
    const rows = [
      { x: 1, v: 10, plot: "1" },
      { x: 2, v: 20, plot: "160" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "plot")];

    const result = transformCartesianData(rows, sources, baseConfig, {
      ...baseOptions,
      supportsContinuousColor: true,
      colorColumnType: "STRING",
    });

    expect(result.chartSeries).toHaveLength(2);
  });

  it("keeps continuous colour for a numeric column when colorMode is unset", () => {
    const rows = [
      { x: 1, v: 10, temp: "23.7" },
      { x: 2, v: 20, temp: "36.3" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "temp")];

    const result = transformCartesianData(rows, sources, baseConfig, {
      ...baseOptions,
      supportsContinuousColor: true,
      colorColumnType: "DOUBLE",
    });

    expect(result.chartSeries).toHaveLength(1);
  });

  it("honours an explicit continuous colorMode", () => {
    const rows = [
      { x: 1, v: 10, genotype: "WT" },
      { x: 2, v: 20, genotype: "mutant" },
    ];
    const sources = [ds("x", "x"), ds("y", "v"), ds("color", "genotype")];

    const result = transformCartesianData(
      rows,
      sources,
      { ...baseConfig, colorMode: "continuous" },
      { ...baseOptions, supportsContinuousColor: true, colorColumnType: "STRING" },
    );

    expect(result.chartSeries).toHaveLength(1);
  });
});

describe("numbered Y axes", () => {
  it("uses the primary axis for horizontal bars with saved axis assignments", () => {
    const sources: ExperimentDataSourceConfig[] = [
      ds("x", "label"),
      ds("y", "a"),
      { ...ds("y", "b"), axis: "y3" },
    ];
    const { chartSeries } = transformCartesianData(
      [{ label: "A", a: 10, b: 100 }],
      sources,
      { orientation: "h", y3AxisType: "log" },
      { ...baseOptions, defaultTraceType: "bar" },
    );
    expect(chartSeries).toMatchObject([
      { traceType: "bar", orientation: "h", axis: "primary" },
      { traceType: "bar", orientation: "h", axis: "primary", x: ["A"], y: [100] },
    ]);
    expect(sources[2].axis).toBe("y3");
  });

  it.each(["secondary", "y3"] as const)(
    "keeps horizontal bars in their facet's primary axes with a saved %s assignment",
    (axis) => {
      const { chartSeries, subplots } = transformCartesianData(
        [
          { a: 1, b: 2, panel: "A" },
          { a: 3, b: 4, panel: "B" },
        ],
        [ds("y", "a"), { ...ds("y", "b"), traceType: "bar", axis }, ds("facet", "panel")],
        { orientation: "h" },
        { ...baseOptions, defaultTraceType: "bar" },
      );
      expect(subplots?.cells.map((cell) => cell.secondaryYaxisId)).toEqual([undefined, undefined]);
      expect(chartSeries.filter(({ name }) => name === "b")).toMatchObject([
        { axis: "primary", xaxisId: "x", yaxisId: "y" },
        { axis: "primary", xaxisId: "x2", yaxisId: "y2" },
      ]);
    },
  );

  it.each(["line", "scatter", "bar", "area"] as const)(
    "routes all six axes for %s",
    (defaultTraceType) => {
      const axes = ["primary", "secondary", "y3", "y4", "y5", "y6"] as const;
      const sources = axes.map((axis, index) => ({ ...ds("y", `v${index}`), axis }));
      const { chartSeries } = transformCartesianData(
        [{ v0: 1, v1: 2, v2: 3, v3: 4, v4: 5, v5: 6 }],
        sources,
        {},
        { ...baseOptions, defaultTraceType },
      );
      expect(chartSeries.map((series) => series.axis)).toEqual(axes);
      expect(chartSeries.map((series) => series.y)).toEqual([[1], [2], [3], [4], [5], [6]]);
    },
  );

  it.each(["y3", "y4", "y5", "y6"] as const)(
    "uses axis 2 for a saved %s assignment with facets",
    (axis) => {
      const sources = [ds("y", "a"), { ...ds("y", "b"), axis }, ds("facet", "panel")];
      const { chartSeries, subplots } = transformCartesianData(
        [
          { a: 1, b: 2, panel: "A" },
          { a: 3, b: 4, panel: "B" },
        ],
        sources,
        {},
        baseOptions,
      );
      expect(subplots?.cells.map((cell) => cell.secondaryYaxisId)).toEqual(["y3", "y4"]);
      expect(
        chartSeries
          .filter((series) => series.name === "b")
          .map((series) => [series.axis, series.yaxisId]),
      ).toEqual([
        ["secondary", "y3"],
        ["secondary", "y4"],
      ]);
      expect(sources[1].axis).toBe(axis);
    },
  );
});
