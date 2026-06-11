import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function windRoseDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    windRoseDirectionBins: 8,
    windRoseValueBins: 5,
    windRoseColorscale: "Viridis",
    windRoseReverseScale: false,
    windRoseShowDirectionLabels: true,
  };
}

export function windRoseDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
