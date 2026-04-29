import type { ChartFormConfig, ChartFormDataConfig } from "../form-values";
import { DEFAULT_PRIMARY_COLOR, makeDataSource } from "../form-values";

export function scatterDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    xAxisType: "linear",
    yAxisType: "linear",
    yAxisTitle: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    mode: "markers",
    color: [DEFAULT_PRIMARY_COLOR],
    marker: {
      size: 6,
      symbol: "circle",
      showscale: true,
      colorscale: "Viridis",
      colorbar: { title: { side: "right", text: "" } },
    },
  };
}

export function scatterDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
