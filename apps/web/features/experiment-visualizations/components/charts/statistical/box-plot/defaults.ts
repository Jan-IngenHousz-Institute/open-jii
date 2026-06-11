import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { DEFAULT_PRIMARY_COLOR } from "../../colors/palettes";
import { makeDataSource } from "../../data/data-sources";

export function boxPlotDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    boxOrientation: "v",
    // `group` lays sibling series side-by-side at each X category (the
    // canonical "compare distributions across groups" look). `overlay`
    // stacks translucent boxes for users who prefer that.
    boxmode: "group",
    // "outliers" shows only points outside +/- 1.5x IQR (Plotly default).
    boxpoints: "outliers",
    boxmean: "false",
    notched: false,
    marker: { opacity: 1 },
  };
}

export function boxPlotDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // X is optional but seeded as a draft so the shelf has a stable entry to bind to.
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
