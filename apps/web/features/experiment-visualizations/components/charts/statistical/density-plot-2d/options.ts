/**
 * 2D density options. Composite of scatter points + `histogram2dcontour`
 * sharing the same X / Y axes.
 */
export interface DensityPlot2DChartOptions {
  density2dMarkerSize?: number;
  density2dMarkerOpacity?: number;
  density2dContourFill?: boolean;
  density2dShowColorbar?: boolean;
}
