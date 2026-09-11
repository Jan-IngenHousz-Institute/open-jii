import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function areaDefaultConfig(): ChartFormConfig {
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
    // Shared AreaChart wrapper defaults `line.width: 0`; in our editor that
    // looks unfinished, so set an explicit width to keep the boundary visible.
    line: { width: 2, smoothing: 0 },
    connectgaps: true,
    stackMode: "none",
    fillOpacity: 0.4,
  };
}

export function areaDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
