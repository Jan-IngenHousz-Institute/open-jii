import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { DEFAULT_PRIMARY_COLOR } from "../../colors/palettes";
import { makeDataSource } from "../../data/data-sources";

export function ridgePlotDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: false,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    // 0.5 is the canonical "mountain ridges" overlap; 0 gives crisply
    // separated lanes, 0.7+ gives the "Joy Division" intermingling look.
    ridgeOverlap: 0.5,
    ridgeFill: true,
    ridgeLineWidth: 1.5,
    // Alphabetical is the safe default (stable across datasets); users
    // pick median when they want visual rhythm to communicate differences.
    ridgeSortOrder: "alphabetical",
    marker: { opacity: 0.7 },
  };
}

export function ridgePlotDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Only Y is seeded; color is added by the ColorDimensionShelf when the
  // user picks a grouping column (matches histogram/density). The role
  // contract marks color as required, so rendering blocks until set.
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "y")],
  };
}
