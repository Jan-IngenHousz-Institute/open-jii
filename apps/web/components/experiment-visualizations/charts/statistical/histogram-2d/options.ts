/**
 * 2D histogram options. Joint distribution of two numeric variables rendered
 * as bin-count heatmap or contour. Plotly bins client-side from raw rows.
 */
export interface Histogram2DChartOptions {
  hist2dNbinsX?: number;
  hist2dNbinsY?: number;
  hist2dHistnorm?: "" | "percent" | "probability" | "density" | "probability density";
  hist2dColorscale?: string;
  hist2dReverseScale?: boolean;
  hist2dShowColorbar?: boolean;
  hist2dColorbarTitle?: string;
  hist2dRenderMode?: "heatmap" | "contour";
  hist2dContourFill?: boolean;
}
