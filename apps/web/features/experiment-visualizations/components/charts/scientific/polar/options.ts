/**
 * Polar options. Scatter / line traces in polar coordinates, one trace per Y
 * series. Defaults follow the compass convention (0 deg at top, clockwise sweep).
 */
export interface PolarChartOptions {
  polarMode?: "markers" | "lines" | "lines+markers";
  polarLineWidth?: number;
  polarMarkerSize?: number;
  polarFill?: boolean;
  polarDirection?: "clockwise" | "counterclockwise";
  polarStartAngle?: number;
}
