import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function carpetDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: false,
    showGrid: false,
    useWebGL: false,
    carpetColorscale: "Viridis",
    carpetReverseScale: false,
    carpetShowColorbar: true,
    carpetColorbarTitle: "",
    carpetNContours: 15,
    carpetContourColoring: "fill",
    carpetShowContourLabels: false,
  };
}

export function carpetDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Seed Z with `avg` so the SQL pipeline yields one row per `(x, y)` cell
  // (same default as heatmap). Without it, replicate factor combinations
  // collapse to whichever row arrives last.
  const zSource = makeDataSource(table, "z");
  zSource.aggregate = "avg";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y"), zSource],
  };
}
