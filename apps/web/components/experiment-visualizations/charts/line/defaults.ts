import type { ChartFormConfig, ChartFormDataConfig } from "../form-values";
import { DEFAULT_PRIMARY_COLOR, makeDataSource } from "../form-values";

export function lineDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    xAxisType: "linear",
    yAxisType: "linear",
    yAxisTitle: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    mode: "lines",
    color: [DEFAULT_PRIMARY_COLOR],
    line: { width: 2, smoothing: 0 },
    connectgaps: true,
  };
}

export function lineDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
