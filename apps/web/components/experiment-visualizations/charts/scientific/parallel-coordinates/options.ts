/**
 * Parallel-coordinates options. Each polyline is one raw row, so there's no
 * SQL aggregation; colorscale / reverseScale / showColorbar / colorbarTitle
 * live on `config.marker.*` (owned by the shared Color dimension shelf).
 */
export interface ParallelCoordinatesChartOptions {
  parcoordsLineWidth?: number;
  parcoordsLineOpacity?: number;
}
