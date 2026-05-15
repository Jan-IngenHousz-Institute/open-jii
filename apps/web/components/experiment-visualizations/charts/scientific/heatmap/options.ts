/**
 * Heatmap options. 2D matrix of cells keyed by `(x, y)` and coloured by `z`;
 * duplicate `(x, y)` rows resolve via the per-source aggregate on Z.
 */
export interface HeatmapChartOptions {
  heatmapColorscale?: string;
  heatmapReverseScale?: boolean;
  heatmapShowColorbar?: boolean;
  heatmapColorbarTitle?: string;
  heatmapZsmooth?: "false" | "best" | "fast";
  heatmapShowText?: boolean;
  heatmapTextDecimals?: number;
}
