/**
 * Box-plot options. The five-number summary is computed client-side from raw
 * `y` arrays, so this namespace only carries layout/marker knobs.
 */
export interface BoxPlotChartOptions {
  boxOrientation?: "v" | "h";
  boxmode?: "group" | "overlay";
  boxpoints?: "outliers" | "all" | "suspectedoutliers" | "false";
  boxmean?: "false" | "true" | "sd";
  notched?: boolean;
}
