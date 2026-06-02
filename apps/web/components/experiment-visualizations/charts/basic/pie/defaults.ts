import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function pieDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    showLegend: true,
    showGrid: false,
    useWebGL: false,
    // Each slice gets its own colour from CATEGORY_PALETTE at render time;
    // `colorMap` is exposed so future per-category overrides slot in the
    // same way scatter's categorical colouring does.
    colorMap: {},
    hole: 0,
    textinfo: "percent",
    pieTextPosition: "auto",
    sortSlices: true,
  };
}

export function pieDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "labels"), makeDataSource(table, "values")],
    // Aggregation isn't seeded; the values shelf writes the function the
    // moment a column or function is chosen, and the labels shelf writes
    // the groupBy. An empty aggregation here would fail validation on save.
  };
}
