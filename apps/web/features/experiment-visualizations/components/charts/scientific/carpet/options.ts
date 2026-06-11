/**
 * Carpet options. Parametric grid (carpet trace) with a contourcarpet overlay;
 * server-side aggregate on the Z source collapses duplicate `(x, y)` rows.
 */
export interface CarpetChartOptions {
  carpetColorscale?: string;
  carpetReverseScale?: boolean;
  carpetShowColorbar?: boolean;
  carpetColorbarTitle?: string;
  carpetNContours?: number;
  carpetContourColoring?: "fill" | "lines" | "none";
  carpetShowContourLabels?: boolean;
}
