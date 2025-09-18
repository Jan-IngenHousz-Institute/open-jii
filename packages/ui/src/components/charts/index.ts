// Chart System
// Note: PlotlyChart is the base component in the parent directory

// Common utilities and types
export * from "./common";

// Chart families
// export * from "./basic";
// export * from "./statistical";
// export * from "./scientific";
// export * from "./3d";

// Subplot support
// Note: Subplot functionality would be implemented here
// This would include tools for creating subplots with multiple chart types
export interface SubplotConfig {
  rows: number;
  cols: number;
  specs?: Array<
    Array<{
      type?: "xy" | "scene" | "polar" | "ternary" | "mapbox" | "domain";
      secondary_y?: boolean;
      colspan?: number;
      rowspan?: number;
    } | null>
  >;
  subplot_titles?: string[];
  shared_xaxes?: boolean;
  shared_yaxes?: boolean;
  vertical_spacing?: number;
  horizontal_spacing?: number;
}

// This would be implemented as a higher-order component that creates subplots
// export function createSubplot(config: SubplotConfig): SubplotComponent;
