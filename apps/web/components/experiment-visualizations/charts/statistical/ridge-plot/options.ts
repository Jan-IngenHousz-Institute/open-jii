/**
 * Ridge-plot options. Stacked KDE curves (Silverman bandwidth, gaussian kernel);
 * horizontal orientation is fixed since the literature treats it as canonical.
 */
export interface RidgePlotChartOptions {
  ridgeOverlap?: number;
  ridgeFill?: boolean;
  ridgeLineWidth?: number;
  ridgeSortOrder?: "alphabetical" | "mean" | "median" | "count";
}
