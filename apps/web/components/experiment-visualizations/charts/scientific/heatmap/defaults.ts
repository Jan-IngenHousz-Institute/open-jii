import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function heatmapDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: false,
    showGrid: false,
    useWebGL: false,
    heatmapColorscale: "Viridis",
    heatmapShowColorbar: true,
    heatmapColorbarTitle: "",
    // Discrete cells by default (canonical academic look); `best`
    // smoothing is opt-in for dense matrices where edges read as noise.
    heatmapZsmooth: "false",
    heatmapShowText: false,
    heatmapTextDecimals: 2,
  };
}

export function heatmapDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Seed Z with `avg` so the SQL pipeline produces one row per `(x, y)`
  // cell server-side. Without it the pivot tries to render raw rows
  // directly, producing a sparse matrix on continuous data.
  const zSource = makeDataSource(table, "z");
  zSource.aggregate = "avg";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y"), zSource],
  };
}
