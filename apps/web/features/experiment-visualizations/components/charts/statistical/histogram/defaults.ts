import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { DEFAULT_PRIMARY_COLOR } from "../../colors/palettes";
import { makeDataSource } from "../../data/data-sources";

export function histogramDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    // Plotly auto-picks bin count when `nbinsx` is unset; expose it as
    // a slider but leave undefined to avoid overriding auto-detection.
    histnorm: "",
    cumulative: false,
    histogramOrientation: "v",
    // `overlay` with reduced opacity is the standard "compare two
    // distributions" look; `stack` is opt-in for cumulative counts.
    histogramBarmode: "overlay",
    marker: { opacity: 0.7 },
  };
}

export function histogramDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // No X role; Plotly bins one or more Y columns and computes the
  // perpendicular axis. The single Y starts as a draft.
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "y")],
  };
}
