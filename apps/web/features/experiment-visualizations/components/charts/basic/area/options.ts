/**
 * Area-family options. `stackMode` is a UI-only abstraction the renderer
 * translates into Plotly's `stackgroup` + `groupnorm` pair.
 */
export interface AreaChartOptions {
  stackMode?: "none" | "stacked" | "percent";
  fillOpacity?: number;
}
