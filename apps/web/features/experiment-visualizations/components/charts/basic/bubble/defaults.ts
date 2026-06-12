import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { DEFAULT_PRIMARY_COLOR } from "../../colors/palettes";
import { makeDataSource } from "../../data/data-sources";

export function bubbleDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    xAxisType: "linear",
    yAxisType: "linear",
    yAxisTitle: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    mode: "markers",
    colorMode: "continuous",
    colorMap: {},
    marker: {
      // Used as the fallback uniform size when no `size` column is picked
      // yet (draft state). Once the size column is chosen, the renderer
      // replaces this with per-row sizes scaled by `sizeref`.
      size: 12,
      symbol: "circle",
      opacity: 0.7,
      showscale: true,
      colorscale: "Viridis",
      colorbar: { title: { side: "right", text: "" } },
    },
    sizemode: "area",
    bubbleMaxSize: 40,
    bubbleMinSize: 4,
  };
}

export function bubbleDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [
      makeDataSource(table, "x"),
      makeDataSource(table, "y"),
      makeDataSource(table, "size"),
    ],
  };
}
