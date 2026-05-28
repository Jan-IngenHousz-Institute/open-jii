/**
 * SPC control-chart options. Mean, sigma, and out-of-control points are
 * computed client-side from raw `(x, y)` rows; this is the Individuals (X)
 * variant. Only Western Electric rule 1 drives outlier highlighting.
 */
export interface SPCChartOptions {
  spcSigmaMultiplier?: number;
  spcShowWarningLimits?: boolean;
  spcHighlightOutliers?: boolean;
  spcMode?: "markers" | "lines" | "lines+markers";
  spcMarkerSize?: number;
  spcMarkerOpacity?: number;
}
