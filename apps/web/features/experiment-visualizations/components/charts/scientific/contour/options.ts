/**
 * Contour options. Shares heatmap's `(x, y, z)` shape, pivoted client-side
 * via `pivotToMatrix`, but renders as iso-lines / filled bands.
 */
export interface ContourChartOptions {
  contourColoring?: "fill" | "lines" | "heatmap";
  contourShowLines?: boolean;
  contourShowLabels?: boolean;
  contourSmoothing?: number;
  contourLineWidth?: number;
  contourNcontours?: number;
  contourColorscale?: string;
  contourReverseScale?: boolean;
  contourShowColorbar?: boolean;
  contourColorbarTitle?: string;
}
