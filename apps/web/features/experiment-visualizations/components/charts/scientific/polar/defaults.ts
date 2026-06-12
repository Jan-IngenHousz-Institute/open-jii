import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function polarDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    polarMode: "markers",
    polarLineWidth: 2,
    polarMarkerSize: 6,
    polarFill: false,
    // Compass convention by default: 0deg at the top, sweep clockwise.
    polarDirection: "clockwise",
    polarStartAngle: 90,
  };
}

export function polarDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
