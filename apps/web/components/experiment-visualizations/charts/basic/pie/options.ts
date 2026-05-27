/**
 * Pie options. `pieTextPosition` is aliased away from line/scatter's
 * `textposition` (compass directions) to avoid a `never` at the intersection
 * of `ChartFormConfig`; the renderer maps it back at render time.
 */
export interface PieChartOptions {
  hole?: number;
  textinfo?:
    | "label"
    | "value"
    | "percent"
    | "label+percent"
    | "label+value"
    | "value+percent"
    | "label+value+percent"
    | "none";
  pieTextPosition?: "inside" | "outside" | "auto" | "none";
  sortSlices?: boolean;
}
