import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function ternaryDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    ternaryMode: "markers",
    ternaryMarkerSize: 7,
    ternaryLineWidth: 2,
    // Most compositional data is reported in percent (default 100);
    // normalized fractions flip to 1 in the Style panel.
    ternarySum: 100,
  };
}

export function ternaryDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Three required component axes (A/B/C) bound to x/y/z roles (same
  // precedent heatmap/contour use for non-cartesian coordinate systems).
  return {
    tableName: table,
    dataSources: [
      makeDataSource(table, "x"),
      makeDataSource(table, "y"),
      makeDataSource(table, "z"),
    ],
  };
}
