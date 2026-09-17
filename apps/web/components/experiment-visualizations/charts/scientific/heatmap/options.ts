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
  /**
   * Present / absent rendering: a cell is "present" when its value is at
   * least `heatmapBinaryThreshold` (default 1) and "absent" otherwise, with
   * an empty cell counting as absent rather than as a gap to interpolate
   * across. Two fixed colours replace the continuous colourscale.
   */
  heatmapBinary?: boolean;
  heatmapBinaryThreshold?: number;
}
