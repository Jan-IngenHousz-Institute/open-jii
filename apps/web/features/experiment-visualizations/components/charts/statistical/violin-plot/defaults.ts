import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { DEFAULT_PRIMARY_COLOR } from "../../colors/palettes";
import { makeDataSource } from "../../data/data-sources";

export function violinPlotDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    violinOrientation: "v",
    // `group` lays sibling violins side-by-side at each X category
    // (matches seaborn `violinplot(hue=...)`).
    violinmode: "group",
    violinSide: "both",
    // `width` (Plotly default) gives every violin the same width
    // regardless of sample size; `count` reflects group-size differences.
    violinScalemode: "width",
    // Embedded box overlay is the canonical violin-with-stats look.
    violinShowBox: true,
    violinShowMeanline: false,
    // `outliers` matches box-plot's default; `all` overlays raw points.
    violinPoints: "outliers",
    marker: { opacity: 1 },
  };
}

export function violinPlotDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Same shape as box-plot: X is optional but seeded as a draft so the
  // shelf has a stable dataSource entry to bind to.
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
