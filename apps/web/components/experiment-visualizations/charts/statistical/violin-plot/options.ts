/**
 * Violin-plot options. The wrapper computes KDE client-side from raw `y`
 * arrays, so this namespace only carries layout/marker knobs.
 */
export interface ViolinPlotChartOptions {
  violinOrientation?: "v" | "h";
  violinmode?: "group" | "overlay";
  violinSide?: "both" | "positive" | "negative";
  violinScalemode?: "width" | "count";
  violinShowBox?: boolean;
  violinShowMeanline?: boolean;
  violinPoints?: "outliers" | "all" | "suspectedoutliers" | "false";
  /** Inner box fill + outline color (overrides the default white/dark). */
  violinBoxColor?: string;
  /** Marker color when points are visible (overrides per-series color). */
  violinMarkerColor?: string;
}
