import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { DEFAULT_PRIMARY_COLOR } from "../../colors/palettes";
import { makeDataSource } from "../../data/data-sources";

export function lollipopDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    xAxisType: "category",
    yAxisType: "linear",
    yAxisTitle: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    orientation: "v",
    marker: { size: 12 },
    stemWidth: 2,
  };
}

export function lollipopDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
