import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function correlationMatrixDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    showLegend: false,
    showGrid: false,
    useWebGL: false,
    corrMethod: "pearson",
    // RdBu (red-blue diverging, anchored at 0) is the canonical academic
    // pick (same colorscale as `corrplot` / seaborn correlation heatmaps).
    corrColorscale: "RdBu",
    corrReverseScale: false,
    corrShowValues: true,
    corrTextDecimals: 2,
    corrShowColorbar: true,
  };
}

export function correlationMatrixDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Seed two empty Y sources so the multi-column shelf has rows to bind to.
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "y"), makeDataSource(table, "y")],
  };
}
