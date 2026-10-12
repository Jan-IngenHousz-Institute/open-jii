import { createVisualization } from "@/test/factories";
import { describe, expect, it } from "vitest";

import type { ChartFormDataConfig, RenderedChartConfig } from "../chart-config";
import { BUCKETED_ROWS, drawsFromBuckets, xScaleOf, zoomReadPlanOf } from "./zoom-read-plan";

function dataConfig(overrides: Partial<ChartFormDataConfig> = {}): ChartFormDataConfig {
  return {
    tableName: "raw_data",
    dataSources: [
      { tableName: "raw_data", columnName: "timestamp", role: "x" },
      { tableName: "raw_data", columnName: "fluo", role: "y" },
      { tableName: "raw_data", columnName: "device_id", role: "color" },
    ],
    ...overrides,
  };
}

const CONFIG: RenderedChartConfig = {};

const FACETED = dataConfig({
  dataSources: [
    ...dataConfig().dataSources,
    { tableName: "raw_data", columnName: "site", role: "facet" },
  ],
});

describe("zoomReadPlanOf", () => {
  it("plans a bucketed read for a line, split by its colour column", () => {
    expect(zoomReadPlanOf(dataConfig(), CONFIG, "line", "time")).toEqual({
      xColumn: "timestamp",
      scale: "time",
      yColumns: ["fluo"],
      splitColumns: ["device_id"],
      readColumns: ["timestamp", "fluo", "device_id"],
    });
  });

  it("buckets each facet apart when the facets share their x", () => {
    expect(zoomReadPlanOf(FACETED, CONFIG, "line", "time")?.splitColumns).toEqual([
      "device_id",
      "site",
    ]);
  });

  it.each([
    [
      "an aggregated chart",
      dataConfig({ aggregation: { groupBy: [{ column: "timestamp", timeBucket: "hour" }] } }),
      CONFIG,
      "line" as const,
    ],
    ["a stacked area", dataConfig(), { stackMode: "stacked" as const }, "area" as const],
    ["a scatter chart", dataConfig(), CONFIG, "scatter" as const],
    ["facets that zoom apart", FACETED, { facetSharedX: false }, "line" as const],
    [
      "a column path the query cannot name",
      dataConfig({
        dataSources: [
          { tableName: "raw_data", columnName: "timestamp", role: "x" as const },
          { tableName: "raw_data", columnName: "macro_output.fluo", role: "y" as const },
        ],
      }),
      CONFIG,
      "line" as const,
    ],
  ])("plans nothing for %s", (_, config, chartConfig, traceType) => {
    expect(zoomReadPlanOf(config, chartConfig, traceType, "time")).toBeUndefined();
  });

  it("plans nothing without a scale", () => {
    expect(zoomReadPlanOf(dataConfig(), CONFIG, "line", undefined)).toBeUndefined();
  });
});

describe("xScaleOf", () => {
  it("reads the scale from the x column's type", () => {
    expect(xScaleOf("TIMESTAMP", [], "timestamp")).toBe("time");
    expect(xScaleOf("DOUBLE", [], "timestamp")).toBe("number");
    expect(xScaleOf("STRING", [{ timestamp: "12.5" }], "timestamp")).toBeUndefined();
  });

  it("falls back to the first value when the type is unknown", () => {
    expect(xScaleOf(undefined, [{ timestamp: "2026-09-25T12:00:00.000Z" }], "timestamp")).toBe(
      "time",
    );
    expect(xScaleOf(undefined, [{ timestamp: "12.5" }], "timestamp")).toBe("number");
    expect(xScaleOf(undefined, [{ timestamp: "site-a" }], "timestamp")).toBeUndefined();
    expect(xScaleOf(undefined, [], "timestamp")).toBeUndefined();
  });
});

describe("drawsFromBuckets", () => {
  const line = createVisualization({ chartType: "line", dataConfig: dataConfig() });

  it("draws a line from buckets once its table has more rows than a plot has pixels", () => {
    expect(drawsFromBuckets(line, BUCKETED_ROWS + 1)).toBe(true);
    expect(drawsFromBuckets(line, BUCKETED_ROWS)).toBe(false);
  });

  it("cannot tell before the table's size is known", () => {
    expect(drawsFromBuckets(line, undefined)).toBeUndefined();
  });

  it("never draws a scatter chart from buckets", () => {
    const scatter = createVisualization({ chartType: "scatter", dataConfig: dataConfig() });

    expect(drawsFromBuckets(scatter, undefined)).toBe(false);
    expect(drawsFromBuckets(scatter, 1_000_000)).toBe(false);
  });
});
