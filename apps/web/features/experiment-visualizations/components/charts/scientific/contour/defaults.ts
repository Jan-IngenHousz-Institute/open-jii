import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function contourDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: false,
    showGrid: false,
    useWebGL: false,
    // Filled bands is the canonical academic look; readers parse a
    // gradient + iso-line pattern faster than iso-lines on white.
    contourColoring: "fill",
    contourShowLines: true,
    contourShowLabels: false,
    // Plotly's default smoothing is 1; 0 produces polygonal iso-lines
    // that look unfinished on continuous data.
    contourSmoothing: 1,
    contourLineWidth: 1,
    // 0 = let Plotly auto-pick a sensible iso-line count.
    contourNcontours: 0,
    contourColorscale: "Viridis",
    contourShowColorbar: true,
    contourColorbarTitle: "",
  };
}

export function contourDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Seed Z with `avg` so the SQL pipeline aggregates server-side
  // (`SELECT x, y, avg(z) GROUP BY x, y`). Same reasoning as heatmap.
  const zSource = makeDataSource(table, "z");
  zSource.aggregate = "avg";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y"), zSource],
  };
}
