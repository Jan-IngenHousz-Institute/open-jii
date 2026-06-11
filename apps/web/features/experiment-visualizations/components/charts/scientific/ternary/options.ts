/**
 * Ternary options. Three-component compositions on a simplex; no SQL aggregation
 * by default. Plotly normalises each row to `ternarySum` (100 for percent, 1 for fractions).
 */
export interface TernaryChartOptions {
  ternaryMode?: "markers" | "lines" | "lines+markers";
  ternaryMarkerSize?: number;
  ternaryLineWidth?: number;
  ternarySum?: 1 | 100;
}
