import { describe, expect, it } from "vitest";

import type { ChartFormDataConfig, RenderedChartConfig } from "../chart-config";
import { zoomReadPlanOf } from "./zoom-read-plan";

const ROWS = [{ timestamp: "2026-09-25T12:00:00.000Z", fluo: "0.4", device_id: "d1" }];

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

describe("zoomReadPlanOf", () => {
  it("plans a time-bucketed read for a line over timestamps, split by its colour column", () => {
    expect(zoomReadPlanOf(dataConfig(), CONFIG, "line", ROWS)).toEqual({
      xColumn: "timestamp",
      scale: "time",
      yColumns: ["fluo"],
      splitColumns: ["device_id"],
      readColumns: ["timestamp", "fluo", "device_id"],
    });
  });

  it("buckets a numeric x by value", () => {
    const plan = zoomReadPlanOf(dataConfig(), CONFIG, "area", [{ timestamp: "12.5", fluo: 1 }]);

    expect(plan?.scale).toBe("number");
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
    [
      "a faceted chart",
      dataConfig({
        dataSources: [
          ...dataConfig().dataSources,
          { tableName: "raw_data", columnName: "site", role: "facet" as const },
        ],
      }),
      CONFIG,
      "line" as const,
    ],
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
    expect(zoomReadPlanOf(config, chartConfig, traceType, ROWS)).toBeUndefined();
  });

  it("plans nothing for a categorical x", () => {
    expect(
      zoomReadPlanOf(dataConfig(), CONFIG, "line", [{ timestamp: "site-a", fluo: 1 }]),
    ).toBeUndefined();
  });
});
