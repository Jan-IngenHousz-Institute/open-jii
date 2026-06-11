import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { DEFAULT_PRIMARY_COLOR } from "../../colors/palettes";
import { makeDataSource } from "../../data/data-sources";

export function spcDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    // Two named traces (Process + Out of control); legend on by default
    // so the user knows which colour means what.
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    // 3-sigma is the industry-standard control band (Shewhart's original
    // recommendation). 2-sigma flags more points but more false positives.
    spcSigmaMultiplier: 3,
    spcShowWarningLimits: false,
    spcHighlightOutliers: true,
    spcMode: "lines+markers",
    spcMarkerSize: 5,
    spcMarkerOpacity: 1,
  };
}

export function spcDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
