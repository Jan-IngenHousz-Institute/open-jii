import type { Config, Layout, PlotData } from "plotly.js";

// Core chart configuration interface for Plotly charts
export interface PlotlyChartConfig extends Partial<Config> {
  // WebGL rendering support
  useWebGL?: boolean;

  // Layout configuration
  title?: string;
  xAxisTitle?: string;
  yAxisTitle?: string;
  zAxisTitle?: string;
  height?: number;
  width?: number;

  // Visual styling
  theme?: "light" | "dark" | "auto";
  showLegend?: boolean;
  showGrid?: boolean;
  backgroundColor?: string;

  // Mode bar configuration
  showModeBar?: boolean;
  modeBarStyle?: "default" | "minimal" | "transparent";

  // Axis configuration
  xAxisType?: "linear" | "log" | "date" | "category" | "multicategory";
  yAxisType?: "linear" | "log" | "date" | "category" | "multicategory";
  zAxisType?: "linear" | "log" | "date" | "category";

  // Annotations and shapes
  annotations?: Array<{
    x: any;
    y: any;
    text: string;
    showarrow?: boolean;
    arrowcolor?: string;
    bgcolor?: string;
    font?: { size?: number; color?: string; family?: string };
  }>;

  shapes?: Array<{
    type: "line" | "circle" | "rect" | "path";
    x0: any;
    y0: any;
    x1: any;
    y1: any;
    line?: { color: string; width: number; dash?: string };
    fillcolor?: string;
    opacity?: number;
  }>;

  // Subplot configuration
  subplot?: {
    rows?: number;
    cols?: number;
    subplotTitles?: string[];
    sharedXAxis?: boolean;
    sharedYAxis?: boolean;
    verticalSpacing?: number;
    horizontalSpacing?: number;
  };

  // Animation configuration
  animation?: {
    duration?: number;
    easing?: "linear" | "quad" | "cubic" | "sin" | "exp" | "circle" | "elastic" | "back" | "bounce";
  };

  // Interaction configuration
  hoverMode?: "x" | "y" | "closest" | "x unified" | "y unified" | false;
  clickMode?: "event" | "select" | "none";
  dragMode?: "zoom" | "pan" | "select" | "lasso" | "orbit" | "turntable" | false;

  // Export configuration
  downloadFilename?: string;
  imageFormat?: "png" | "jpeg" | "webp" | "svg";
}

// Base data series interface
export interface BaseSeries {
  name?: string;
  color?: string | string[];
  opacity?: number;
  visible?: boolean | "legendonly";
  showlegend?: boolean;
  legendgroup?: string;
  hovertemplate?: string;
  hoverinfo?: string;
  customdata?: any[];
}

// Marker configuration
export interface MarkerConfig {
  size?: number | number[];
  color?: string | string[] | number[];
  symbol?: string | string[];
  opacity?: number | number[];
  colorscale?: string | Array<[number, string]>;
  showscale?: boolean;
  colorbar?: {
    title?: {
      text?: string;
      font?: SafeFont;
      side?: "right" | "top" | "bottom";
    };
    thickness?: number;
    len?: number;
  };
  line?: {
    color?: string | string[];
    width?: number | number[];
  };
}

// Line configuration
export interface LineConfig {
  color?: string;
  width?: number;
  dash?: "solid" | "dot" | "dash" | "longdash" | "dashdot" | "longdashdot";
  shape?: "linear" | "spline" | "hv" | "vh" | "hvh" | "vhv";
  smoothing?: number;
}

// Error bar configuration
export interface ErrorBarConfig {
  type?: "data" | "percent" | "sqrt" | "constant";
  array?: number[];
  value?: number;
  visible?: boolean;
  color?: string;
  thickness?: number;
  width?: number;
}

// 3D camera configuration
export interface Camera3D {
  eye?: { x: number; y: number; z: number };
  center?: { x: number; y: number; z: number };
  up?: { x: number; y: number; z: number };
}

// Base props interface that all chart components extend
export interface BaseChartProps {
  config?: PlotlyChartConfig;
  className?: string;
  loading?: boolean;
  error?: string;
}

// WebGL detection utility type
export type WebGLRenderer = "webgl" | "svg";

// Subplot types
export type SubplotType = "xy" | "scene" | "polar" | "ternary" | "mapbox" | "geo";

// Enhanced Plotly types to reduce 'any' usage
export interface SafeFont {
  family?: string;
  size?: number;
  color?: string;
}

export interface SafeTitle {
  text: string;
  font?: SafeFont;
}

export interface SafeAxis {
  title?: string | SafeTitle;
  min?: number;
  max?: number;
  tick0?: number;
  dtick?: number;
  tickmode?: "linear" | "array";
  tickvals?: number[];
  ticktext?: string[];
  gridcolor?: string;
  linecolor?: string;
  showgrid?: boolean;
  showline?: boolean;
  showticklabels?: boolean;
}

export interface SafeSceneLayout {
  xaxis?: SafeAxis;
  yaxis?: SafeAxis;
  zaxis?: SafeAxis;
  camera?: {
    eye?: { x?: number; y?: number; z?: number };
    center?: { x?: number; y?: number; z?: number };
    up?: { x?: number; y?: number; z?: number };
  };
  aspectmode?: "cube" | "data" | "auto";
  aspectratio?: { x?: number; y?: number; z?: number };
}

export interface SafeLayout extends Partial<Omit<Layout, "yaxis" | "scene">> {
  barmode?: "stack" | "group" | "overlay" | "relative";
  barnorm?: "" | "fraction" | "percent";
  violinmode?: "group" | "overlay";
  scene?: SafeSceneLayout;
  yaxis?: SafeAxis;
}

// Type-safe PlotData that maintains Plotly compatibility while reducing any usage
export type SafePlotData = PlotData;

// Export all plotly.js types for convenience
export type { Config, Layout, PlotData } from "plotly.js";
