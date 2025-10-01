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

// Union type for all chart configurations
export type ChartConfig = ScatterChartConfig | LineChartConfig;

// Type guards for chart configurations
export const isScatterChartConfig = (config: ChartConfig): config is ScatterChartConfig => {
  return "markerSize" in config || "markerShape" in config;
};

export const isLineChartConfig = (config: ChartConfig): config is LineChartConfig => {
  return "lineWidth" in config || "connectGaps" in config;
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

    default:
      return baseDefaults;
  }
};
