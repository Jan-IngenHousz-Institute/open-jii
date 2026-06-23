import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { DEFAULT_PRIMARY_COLOR } from "../../colors/palettes";
import { makeDataSource } from "../../data/data-sources";

export function densityPlot2DDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    xAxisTitle: "",
    yAxisTitle: "",
    showLegend: false,
    showGrid: true,
    useWebGL: false,
    color: [DEFAULT_PRIMARY_COLOR],
    // Smaller and more translucent than scatter defaults: points sit
    // under the contour layer and should stay unobtrusive.
    density2dShowMarkers: true,
    density2dMarkerSize: 4,
    density2dMarkerOpacity: 0.4,
    density2dContourFill: false,
    density2dShowColorbar: true,
    // Reuse the histogram-2d colour-mapping namespace; underlying Plotly
    // trace is `histogram2dcontour`, so bin counts / colorscale parallel.
    hist2dNbinsX: 0,
    hist2dNbinsY: 0,
    hist2dColorscale: "Viridis",
    hist2dColorbarTitle: "",
  };
}

export function densityPlot2DDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Same role shape as histogram-2d: both X and Y are required and
  // numeric; the renderer pairs them for scatter and contour binning.
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "x"), makeDataSource(table, "y")],
  };
}
