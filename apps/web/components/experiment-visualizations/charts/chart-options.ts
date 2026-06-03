export interface ColorEncodingOptions {
  colorMode?: "continuous" | "categorical";
  colorMap?: Record<string, string>;
}

export interface BarChartOptions {
  orientation?: "v" | "h";
  barmode?: "group" | "stack" | "overlay" | "relative";
  barnorm?: "" | "fraction" | "percent";
  bargap?: number;
  bargroupgap?: number;
}

/** Small-multiples / facet grid options. Drives `layout.grid` + numbered axes. */
export interface FacetOptions {
  facetColumns?: number;
  facetSharedX?: boolean;
  facetSharedY?: boolean;
  facetRowOrder?: "top-to-bottom" | "bottom-to-top";
  facetSharedXTitle?: boolean;
  facetSharedYTitle?: boolean;
}

/** A single axis-aligned reference line (threshold / target) layered over a chart. */
export interface ReferenceLine {
  axis: "x" | "y";
  value: number;
  label?: string;
  color?: string;
  dash?: "solid" | "dash" | "dot" | "dashdot";
  width?: number;
}

export interface ReferenceLinesOptions {
  referenceLines?: ReferenceLine[];
}

/** Error-bar appearance. Attached to any cartesian series via `DataSourceConfig.errorColumn`. */
export interface ErrorBarChartOptions {
  errorBarThickness?: number;
  errorBarCapWidth?: number;
}

/** Styling for the secondary Y axis, active when any series has `axis: "secondary"`. */
export interface SecondaryAxisOptions {
  y2AxisTitle?: string;
  y2AxisType?: "linear" | "log" | "date" | "category";
}
