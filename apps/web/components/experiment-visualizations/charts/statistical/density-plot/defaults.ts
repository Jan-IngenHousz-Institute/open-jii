import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { DEFAULT_PRIMARY_COLOR } from "../../colors/palettes";
import { makeDataSource } from "../../data/data-sources";

export function densityPlotDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    densityOrientation: "v",
    // Line-only by default: overlapping filled curves stack visual weight
    // quickly across categories. Users opt into fills for one or two curves.
    densityFill: false,
    densityCumulative: false,
    densityLineWidth: 2,
    // Slight transparency keeps overlapping curves readable on a color
    // split; doubles as fill alpha when enabled.
    marker: { opacity: 0.7 },
  };
}

export function densityPlotDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Same shape as histogram: one Y draft, no X (renderer synthesizes X
  // from KDE sampling). Color is added on demand via the shelf.
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "y")],
  };
}
