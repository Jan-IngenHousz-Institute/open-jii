/**
 * Radar options. Y values aggregate per unique color value via the SQL pipeline
 * (`extraGroupByColumns` folds the color column into `groupBy` automatically).
 */
export interface RadarChartOptions {
  radarFill?: boolean;
  radarFillOpacity?: number;
  radarLineWidth?: number;
  radarShowMarkers?: boolean;
}
