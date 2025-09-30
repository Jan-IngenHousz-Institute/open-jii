/**
 * Comprehensive Chart Configuration Types
 *
 * This file defines the TypeScript interfaces for all chart configuration structures
 * to ensure consistency between configurators and renderers.
 */

// Base display configuration shared by all charts
export interface BaseDisplayConfig {
  title?: string;
  showLegend?: boolean;
  legendPosition?: "top" | "bottom" | "left" | "right";
}

// Base axis configuration
export interface BaseAxisConfig {
  title?: string;
  type?: "linear" | "log" | "date" | "category";
  showGrid?: boolean;
  gridColor?: string;
  showLine?: boolean;
  lineColor?: string;
  showTickLabels?: boolean;
}

// Color configuration
export interface ColorConfig {
  color?: string;
  colorScale?: string;
  colorscale?: string; // Some charts use lowercase
  showColorBar?: boolean;
  showscale?: boolean; // Some charts use lowercase
  reversescale?: boolean;
}

// Marker configuration
export interface MarkerConfig {
  size?: number;
  shape?: "circle" | "square" | "diamond" | "triangle" | "cross";
  color?: string;
  opacity?: number;
}

// Line configuration
export interface LineConfig {
  width?: number;
  color?: string;
  dash?: "solid" | "dash" | "dot";
  opacity?: number;
}

// Base chart configuration that all charts extend
export interface BaseChartConfig extends ColorConfig {
  // Index signature for flexibility with existing form structure
  [key: string]: unknown;

  // Display properties
  display?: BaseDisplayConfig;

  // Axis titles (simplified from nested structure)
  xTitle?: string;
  yTitle?: string;
  zTitle?: string;

  // Chart title (top-level for backward compatibility)
  title?: string;
  chartTitle?: string;

  // Common properties
  mode?: "lines" | "markers" | "lines+markers" | "text" | "none";
  interactive?: boolean;

  // Grid configuration
  showGrid?: boolean;
  gridLines?: "both" | "x" | "y" | "none";
  showgrid?: boolean; // Some charts use lowercase

  // Background
  backgroundColor?: string;
  backgroundOpacity?: number;
}

// Scatter Chart Configuration
export interface ScatterChartConfig extends BaseChartConfig {
  // Scatter-specific properties
  markerSize?: number;
  markerShape?: "circle" | "square" | "diamond" | "triangle" | "cross";
  markerColor?: string;

  // Axis types
  xAxisType?: "linear" | "log" | "date";
  yAxisType?: "linear" | "log" | "date";

  // Axis titles
  xAxisTitle?: string; // Backward compatibility
  yAxisTitle?: string; // Backward compatibility
}

// Line Chart Configuration
export interface LineChartConfig extends BaseChartConfig {
  // Line-specific properties
  lineWidth?: number;
  smoothing?: number;
  connectGaps?: boolean;
  fillMode?: "none" | "tozeroy" | "tonexty" | "toself";
  fillOpacity?: number;

  // Multiple series support
  showMarkers?: boolean;
  markerSize?: number;
}

// Bar Chart Configuration
export interface BarChartConfig extends BaseChartConfig {
  // Bar-specific properties
  orientation?: "vertical" | "horizontal";
  barMode?: "group" | "stack" | "overlay" | "relative";
  barWidth?: number;
  showValues?: boolean;

  // Gap configuration
  bargap?: number;
  bargroupgap?: number;
}

// Area Chart Configuration
export interface AreaChartConfig extends BaseChartConfig {
  // Area-specific properties
  fillMode?: "tozeroy" | "tonexty" | "toself";
  fillOpacity?: number;
  stackgroup?: string;

  // Line properties
  lineWidth?: number;
  showLine?: boolean;
}

// Pie Chart Configuration
export interface PieChartConfig extends BaseChartConfig {
  // Pie-specific properties
  hole?: number; // For donut charts
  textPosition?: "inside" | "outside" | "auto" | "none";
  showLabels?: boolean;
  showValues?: boolean;

  // Label configuration
  textColor?: string;
  textSize?: number;
}

// Bubble Chart Configuration
export interface BubbleChartConfig extends BaseChartConfig {
  // Bubble-specific properties
  markerSizeMin?: number;
  markerSizeMax?: number;
  markerSizeMode?: "diameter" | "area";
  markerOpacity?: number;
}

// Heatmap Configuration
export interface HeatmapConfig extends BaseChartConfig {
  // Heatmap-specific properties
  showText?: boolean;
  textColor?: string;
  textSize?: number;
  aspectRatio?: "auto" | "equal";

  // Data column mappings (simplified)
  xColumn?: string;
  yColumn?: string;
  zColumn?: string;
}

// Box Plot Configuration
export interface BoxPlotConfig extends BaseChartConfig {
  // Box plot-specific properties
  boxMode?: "group" | "overlay";
  boxPoints?: "all" | "outliers" | "suspectedoutliers" | "false";
  notched?: boolean;
  jitter?: number;
  pointpos?: number;
}

// Histogram Configuration
export interface HistogramConfig extends BaseChartConfig {
  // Histogram-specific properties
  nbins?: number;
  autobinx?: boolean;
  binSize?: number;
  showNormal?: boolean;

  // Styling
  opacity?: number;
  barmode?: "overlay" | "group" | "stack";
}

// Dot Plot Configuration
export interface DotPlotConfig extends BaseChartConfig {
  // Dot plot-specific properties
  dotSize?: number;
  jitter?: number;
  stackDir?: "up" | "down" | "center";
}

// Lollipop Chart Configuration
export interface LollipopConfig extends BaseChartConfig {
  // Lollipop-specific properties
  stemWidth?: number;
  stemColor?: string;
  markerSize?: number;
  markerColor?: string;
}

// Contour Chart Configuration
export interface ContourConfig extends BaseChartConfig {
  // Contour-specific properties
  ncontours?: number;
  autocontour?: boolean;
  contours?: {
    start?: number;
    end?: number;
    size?: number;
  };
}

// Radar Chart Configuration
export interface RadarChartConfig extends BaseChartConfig {
  // Radar-specific properties
  fill?: "none" | "toself" | "tonext";
  opacity?: number;

  // Angular axis
  thetaunit?: "radians" | "degrees";
  direction?: "clockwise" | "counterclockwise";
  rotation?: number;

  // Grid
  showticklabels?: boolean;
  gridShape?: "circular" | "linear";
}

// Ternary Chart Configuration
export interface TernaryChartConfig extends BaseChartConfig {
  // Ternary-specific properties
  sum?: number;

  // Axis titles
  aAxisTitle?: string;
  bAxisTitle?: string;
  cAxisTitle?: string;

  // Grid properties
  aAxisProps?: BaseAxisConfig;
  bAxisProps?: BaseAxisConfig;
  cAxisProps?: BaseAxisConfig;
}

// Log Plot Configuration
export interface LogPlotConfig extends BaseChartConfig {
  // Log plot-specific properties (extends line chart)
  yAxes?: {
    title?: string;
    type?: "linear" | "log";
    side?: "left" | "right";
    color?: string;
  }[];
}

// Parallel Coordinates Configuration
export interface ParallelCoordinatesConfig extends BaseChartConfig {
  // Parallel coordinates-specific properties
  dimensions?: {
    label?: string;
    range?: [number, number];
    constraintrange?: [number, number];
  }[];

  // Line styling
  lineOpacity?: number;
  lineWidth?: number;
}

// Correlation Matrix Configuration
export interface CorrelationMatrixConfig extends BaseChartConfig {
  // Correlation matrix-specific properties
  showText?: boolean;
  textColor?: string;
  textSize?: number;
  showDiagonal?: boolean;
  method?: "pearson" | "spearman" | "kendall";
}

// Union type for all chart configurations
export type ChartConfig =
  | ScatterChartConfig
  | LineChartConfig
  | BarChartConfig
  | AreaChartConfig
  | PieChartConfig
  | BubbleChartConfig
  | HeatmapConfig
  | BoxPlotConfig
  | HistogramConfig
  | DotPlotConfig
  | LollipopConfig
  | ContourConfig
  | RadarChartConfig
  | TernaryChartConfig
  | LogPlotConfig
  | ParallelCoordinatesConfig
  | CorrelationMatrixConfig;

// Type guards for chart configurations
export const isScatterChartConfig = (config: ChartConfig): config is ScatterChartConfig => {
  return "markerSize" in config || "markerShape" in config;
};

export const isLineChartConfig = (config: ChartConfig): config is LineChartConfig => {
  return "lineWidth" in config || "connectGaps" in config;
};

export const isBarChartConfig = (config: ChartConfig): config is BarChartConfig => {
  return "orientation" in config || "barMode" in config;
};

// Helper function to get default config for chart type
export const getDefaultChartConfig = (chartType: string): ChartConfig => {
  const baseDefaults: BaseChartConfig = {
    display: {
      title: "",
      showLegend: true,
      legendPosition: "right",
    },
    xTitle: "",
    yTitle: "",
    zTitle: "",
    title: "",
    chartTitle: "",
    mode: "lines",
    interactive: true,
    showGrid: true,
    gridLines: "both",
    color: "#3b82f6",
    colorScale: "Viridis",
    showColorBar: true,
  };

  switch (chartType) {
    case "scatter":
      return {
        ...baseDefaults,
        mode: "markers",
        markerSize: 6,
        markerShape: "circle",
        xAxisType: "linear",
        yAxisType: "linear",
        xTitle: "",
        yTitle: "",
        zTitle: "",
        color: "#3b82f6",
        colorScale: "Viridis",
        showColorBar: true,
        gridLines: "both",
        title: "",
        showLegend: true,
        legendPosition: "right",
        ySeries: [{ side: "left" }],
      } as ScatterChartConfig;

    case "line":
      return {
        ...baseDefaults,
        mode: "lines",
        lineWidth: 2,
        smoothing: 0,
        connectGaps: true,
        fillMode: "none",
        showMarkers: false,
        markerSize: 4,
        yAxisTitle: "",
        title: "",
        showLegend: true,
        legendPosition: "right",
        showGrid: true,
        colorScheme: "default",
      } as LineChartConfig;

    case "bar":
      return {
        ...baseDefaults,
        orientation: "vertical",
        barMode: "group",
        barWidth: 0.7,
        showValues: false,
        chartTitle: "",
      } as BarChartConfig;

    case "area":
      return {
        ...baseDefaults,
        fillMode: "tozeroy",
        fillOpacity: 0.6,
        lineWidth: 2,
        showLine: true,
      } as AreaChartConfig;

    case "pie":
      return {
        ...baseDefaults,
        hole: 0,
        textPosition: "auto",
        showLabels: true,
        showValues: true,
        textColor: "#ffffff",
        textSize: 12,
      } as PieChartConfig;

    case "bubble":
      return {
        ...baseDefaults,
        mode: "markers",
        markerSizeMin: 5,
        markerSizeMax: 50,
        markerSizeMode: "area",
        markerOpacity: 0.7,
      } as BubbleChartConfig;

    case "heatmap":
      return {
        ...baseDefaults,
        showText: false,
        textColor: "#ffffff",
        textSize: 12,
        aspectRatio: "auto",
      } as HeatmapConfig;

    case "box-plot":
      return {
        ...baseDefaults,
        boxMode: "group",
        boxPoints: "outliers",
        notched: false,
        jitter: 0.3,
      } as BoxPlotConfig;

    case "histogram":
      return {
        ...baseDefaults,
        nbins: 20,
        autobinx: true,
        opacity: 0.8,
        barmode: "overlay",
      } as HistogramConfig;

    case "dot-plot":
      return {
        ...baseDefaults,
        mode: "markers",
        dotSize: 15,
        jitter: 0.3,
        stackDir: "center",
      } as DotPlotConfig;

    case "lollipop":
      return {
        ...baseDefaults,
        stemWidth: 3,
        stemColor: "#cccccc",
        markerSize: 10,
        markerColor: "#3b82f6",
      } as LollipopConfig;

    case "contour":
      return {
        ...baseDefaults,
        ncontours: 15,
        autocontour: true,
      } as ContourConfig;

    case "radar":
      return {
        ...baseDefaults,
        fill: "none",
        opacity: 0.8,
        thetaunit: "degrees",
        direction: "clockwise",
        rotation: 90,
        showticklabels: true,
        gridShape: "circular",
      } as RadarChartConfig;

    case "ternary":
      return {
        ...baseDefaults,
        sum: 100,
        aAxisTitle: "",
        bAxisTitle: "",
        cAxisTitle: "",
      } as TernaryChartConfig;

    case "log-plot":
      return {
        ...baseDefaults,
        mode: "lines+markers",
        yAxes: [],
      } as LogPlotConfig;

    case "parallel-coordinates":
      return {
        ...baseDefaults,
        dimensions: [],
        lineOpacity: 0.7,
        lineWidth: 1,
      } as ParallelCoordinatesConfig;

    case "correlation-matrix":
      return {
        ...baseDefaults,
        showText: true,
        textColor: "#000000",
        textSize: 10,
        showDiagonal: true,
        method: "pearson",
      } as CorrelationMatrixConfig;

    default:
      return baseDefaults;
  }
};
