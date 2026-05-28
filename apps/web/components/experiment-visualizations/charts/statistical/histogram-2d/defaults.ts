import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function histogram2DDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: false,
    showGrid: true,
    useWebGL: false,
    // 0 = "let Plotly auto-pick a sensible bin count" (same convention
    // as 1D histogram). Users tune via the slider as needed.
    hist2dNbinsX: 0,
    hist2dNbinsY: 0,
    hist2dHistnorm: "",
    // Viridis is the canonical scientific colorscale (perceptually
    // uniform, colorblind-safe). Default for continuous color elsewhere.
    hist2dColorscale: "Viridis",
    hist2dShowColorbar: true,
    hist2dColorbarTitle: "",
    // Heatmap is the canonical histogram-2d look; users opt into
    // contour mode (filled bands or iso-lines) when their data is
    // smoother and the contour reads better than a per-cell heatmap.
    hist2dRenderMode: "heatmap",
  };
}

export function histogram2DDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Both X and Y are required and seeded as drafts so each axis shelf
  // has a stable data source to bind to.
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
