import type { ChartFormConfig, ChartFormDataConfig } from "../form-values";
import { DEFAULT_PRIMARY_COLOR, makeDataSource } from "../form-values";

export function barDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    xAxisType: "category",
    yAxisType: "linear",
    yAxisTitle: "",
    showLegend: false,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    orientation: "v",
    sortDirection: null,
    topN: undefined,
    aggregationFunction: "count",
  };
}

/**
 * Seeds X + Y data sources and a default aggregation. The renderer falls
 * back to `count` when no function is configured, but persisting an
 * explicit default keeps the wire payload self-describing and lets the
 * data panel render the picker without a "phantom undefined" state.
 */
export function barDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
