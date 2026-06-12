/**
 * Histogram options. Plotly bins one (or more) Y columns; the perpendicular
 * axis shows row count per bin, with `histnorm` rescaling for density / probability.
 */
export interface HistogramChartOptions {
  histogramOrientation?: "v" | "h";
  histnorm?: "" | "percent" | "probability" | "density" | "probability density";
  nbinsx?: number;
  cumulative?: boolean;
  histogramBarmode?: "stack" | "group" | "overlay" | "relative";
  showNormalFit?: boolean;
}
