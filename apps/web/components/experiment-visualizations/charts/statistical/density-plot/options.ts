/**
 * Density-plot options. Client-side Gaussian KDE (Silverman bandwidth, 200
 * samples); no SQL aggregate.
 */
export interface DensityPlotChartOptions {
  densityOrientation?: "v" | "h";
  densityFill?: boolean;
  densityCumulative?: boolean;
  densityLineWidth?: number;
}
