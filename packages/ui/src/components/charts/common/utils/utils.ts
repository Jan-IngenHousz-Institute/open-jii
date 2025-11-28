import type { Config, Layout } from "plotly.js";

import type { PlotlyChartConfig, WebGLRenderer } from "../types";

/**
 * Detects WebGL support in the browser
 */
export function detectWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return false;

    // Test if we have a WebGL context (not just a regular canvas context)
    const isWebGL =
      gl instanceof WebGLRenderingContext ||
      (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext);

    return isWebGL;
  } catch (e) {
    return false;
  }
}

/**
 * Determines the appropriate renderer based on configuration and browser support
 */
export function getRenderer(useWebGL: boolean = false): WebGLRenderer {
  if (useWebGL === true) {
    return detectWebGLSupport() ? "webgl" : "svg";
  }

  return "svg";
}

/**
 * Validates and sanitizes dimensions to prevent NaN errors
 */
export function validateDimensions(
  width?: number,
  height?: number,
): { width: number; height: number } {
  const safeWidth = typeof width === "number" && !isNaN(width) && width > 0 ? width : 400;
  const safeHeight = typeof height === "number" && !isNaN(height) && height > 0 ? height : 300;

  return { width: safeWidth, height: safeHeight };
}

/**
 * Converts chart type to appropriate WebGL type if WebGL is enabled
 */
export function getPlotType(baseType: string, renderer: WebGLRenderer): string {
  if (renderer === "svg") return baseType;

  // WebGL type mappings
  const webglTypes: Record<string, string> = {
    scatter: "scattergl",
    line: "scattergl",
    bar: "bar", // Bar charts don't have WebGL equivalent
    histogram: "histogram", // Histogram doesn't have WebGL equivalent
    heatmap: "heatmapgl",
    contour: "contour", // Contour doesn't have WebGL equivalent
    scatter3d: "scatter3d", // 3D plots are already optimized
    surface: "surface",
    mesh3d: "mesh3d",
  };

  return webglTypes[baseType] || baseType;
}

// Layout configuration constants
const LAYOUT_CONSTANTS = {
  // X-axis domain margins based on number of y-axes on each side
  DOMAIN_MARGINS: {
    LEFT: [0.05, 0.13, 0.18, 0.23], // margins for 1, 2, 3, 4 left axes
    RIGHT: [0.95, 0.87, 0.82, 0.78], // margins for 1, 2, 3, 4 right axes
  },
  // Legend positions based on number of right-side y-axes
  LEGEND_POSITIONS: [0.95, 1.0, 1.05, 1.1], // positions for 0, 1, 2, 3 right axes
  // Third axis positions
  THIRD_AXIS_POSITIONS: {
    LEFT: {
      MANY_AXES: 0.10, // when 3+ axes on left
      FEW_AXES: 0.05, // when < 3 axes on left
    },
    RIGHT: {
      MANY_AXES: 0.91, // when 3+ axes on right
      FEW_AXES: 0.95, // when < 3 axes on right
    },
  },
  // Outermost axis positions
  OUTER_AXIS_POSITIONS: {
    LEFT: 0.0,
    RIGHT: 1.0,
  },
  // Axis count threshold for dynamic positioning
  AXIS_COUNT_THRESHOLD: 3,
} as const;

/**
 * Creates base layout for all charts with PlotlyChartConfig
 */
export function createBaseLayout(config: PlotlyChartConfig): Partial<Layout> {
  const {
    theme,
    title,
    xAxisTitle,
    yAxis = [],
    xAxisType = "linear",
    showLegend = true,
    showGrid = true,
    backgroundColor,
    annotations = [],
    shapes = [],
    hoverMode = "closest",
    dragMode = "zoom",
  } = config;

  // Use provided dimensions or undefined for responsive behavior
  const { width, height } = config;

  const isDark = theme === "dark";

  const colorScheme: Record<"dark" | "light" | "auto", { grid: string; text: string; bg: string }> =
    {
      dark: { grid: "rgba(255,255,255,0.1)", text: "#ffffff", bg: "#0f0f0f" },
      light: { grid: "rgba(0,0,0,0.1)", text: "#000000", bg: "#ffffff" },
      auto: { grid: "rgba(0,0,0,0.1)", text: "#000000", bg: "#ffffff" }, // Default to light
    };

  const gridColor = colorScheme[theme ?? "auto"].grid;
  const textColor = colorScheme[theme ?? "auto"].text;
  const bgColor = backgroundColor || "rgba(0,0,0,0)";
  const paperBgColor = backgroundColor || colorScheme[theme ?? "auto"].bg;

  // Calculate total axes on each side (used for positioning and margins)
  const leftAxesCount = [yAxis[0], yAxis[2], yAxis[4]].filter((axis) => axis?.title).length;
  const rightAxesCount = [yAxis[1], yAxis[3], yAxis[5]].filter((axis) => axis?.title).length;
  const totalAxesCount = leftAxesCount + rightAxesCount;

  // Calculate dynamic positions for third axes
  const leftThirdAxisPosition =
    leftAxesCount >= LAYOUT_CONSTANTS.AXIS_COUNT_THRESHOLD
      ? LAYOUT_CONSTANTS.THIRD_AXIS_POSITIONS.LEFT.MANY_AXES
      : LAYOUT_CONSTANTS.THIRD_AXIS_POSITIONS.LEFT.FEW_AXES;
  const rightThirdAxisPosition =
    rightAxesCount >= LAYOUT_CONSTANTS.AXIS_COUNT_THRESHOLD
      ? LAYOUT_CONSTANTS.THIRD_AXIS_POSITIONS.RIGHT.MANY_AXES
      : LAYOUT_CONSTANTS.THIRD_AXIS_POSITIONS.RIGHT.FEW_AXES;

  // Helper to build y-axis configuration
  const buildYAxis = (index: number) => {
    const axisConfig = yAxis[index];
    if (!axisConfig) return undefined;

    // Only use custom color if there are multiple axes
    const axisColor = totalAxesCount > 1 ? (axisConfig.color || textColor) : textColor;
    const axisType = axisConfig.type || "linear";
    const axisTitle = axisConfig.title;

    // Define positioning based on index
    const positions: Array<
      Pick<Partial<Layout["yaxis"]>, "side" | "overlaying" | "anchor" | "position">
    > = [
      { side: "left", overlaying: undefined, position: undefined },
      { side: "right", overlaying: "y", anchor: "x", position: undefined },
      { side: "left", overlaying: "y", anchor: "free", position: leftThirdAxisPosition },
      { side: "right", overlaying: "y", anchor: "free", position: rightThirdAxisPosition },
      { side: "left", overlaying: "y", anchor: "free", position: LAYOUT_CONSTANTS.OUTER_AXIS_POSITIONS.LEFT },
      { side: "right", overlaying: "y", anchor: "free", position: LAYOUT_CONSTANTS.OUTER_AXIS_POSITIONS.RIGHT },
    ];

    const pos = positions[index] || positions[0];

    return {
      title: axisTitle
        ? {
            text: axisTitle,
            font: { size: 14, color: axisColor, family: "Inter, sans-serif" },
          }
        : undefined,
      gridcolor: index === 0 && showGrid ? gridColor : "rgba(0,0,0,0)",
      showgrid: index === 0 && showGrid,
      type: axisType,
      color: axisColor,
      showline: true,
      linecolor: axisColor || gridColor,
      tickcolor: axisColor || gridColor,
      tickfont: { color: axisColor },
      automargin: true,
      ...pos,
    };
  };

  const layout: Partial<Layout> = {
    title: title
      ? {
          text: title,
          font: { size: 16, family: "Inter, sans-serif", color: textColor },
        }
      : undefined,

    xaxis: {
      title: xAxisTitle
        ? { text: xAxisTitle, font: { size: 14, color: textColor, family: "Inter, sans-serif" } }
        : undefined,
      gridcolor: showGrid ? gridColor : "rgba(0,0,0,0)",
      showgrid: showGrid,
      type: xAxisType,
      color: textColor,
      showline: true,
      linecolor: gridColor,
      tickcolor: gridColor,
      automargin: true,
      domain: (() => {
        const leftMargin = LAYOUT_CONSTANTS.DOMAIN_MARGINS.LEFT[leftAxesCount - 1] ?? LAYOUT_CONSTANTS.DOMAIN_MARGINS.LEFT[0];
        const rightMargin = LAYOUT_CONSTANTS.DOMAIN_MARGINS.RIGHT[rightAxesCount - 1] ?? LAYOUT_CONSTANTS.DOMAIN_MARGINS.RIGHT[0];
        return [leftMargin, rightMargin];
      })(),
    },

    // Build y-axes dynamically
    ...(buildYAxis(0) && { yaxis: buildYAxis(0) }),
    ...(buildYAxis(1) && { yaxis2: buildYAxis(1) }),
    ...(buildYAxis(2) && { yaxis3: buildYAxis(2) }),
    ...(buildYAxis(3) && { yaxis4: buildYAxis(3) }),
    ...(buildYAxis(4) && { yaxis5: buildYAxis(4) }),
    ...(buildYAxis(5) && { yaxis6: buildYAxis(5) }),

    showlegend: showLegend,
    legend: (() => {
      const legendX = LAYOUT_CONSTANTS.LEGEND_POSITIONS[rightAxesCount] ?? LAYOUT_CONSTANTS.LEGEND_POSITIONS[0];

      return {
        x: legendX,
        y: 1,
        xanchor: "left",
        bgcolor: isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)",
        bordercolor: gridColor,
        borderwidth: 1,
        font: { color: textColor, family: "Inter, sans-serif" },
      };
    })(),

    margin: { l: 60, r: 40, t: title ? 60 : 20, b: 60 },
    autosize: !width && !height, // Enable autosize when no fixed dimensions
    ...(width && { width }), // Only include width if it's defined
    ...(height && { height }), // Only include height if it's defined
    plot_bgcolor: bgColor,
    paper_bgcolor: paperBgColor,

    font: {
      family: "Inter, sans-serif",
      color: textColor,
      size: 12,
    },

    annotations: annotations.map((ann) => ({
      ...ann,
      font: {
        color: ann.font?.color || textColor,
        size: ann.font?.size || 12,
        family: ann.font?.family || "Inter, sans-serif",
      },
      bgcolor: ann.bgcolor || (isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)"),
      bordercolor: gridColor,
      borderwidth: 1,
    })),

    shapes: shapes as any,

    hovermode: hoverMode,
    dragmode: dragMode,

    // Animation settings
    transition: config.animation
      ? {
          duration: config.animation.duration || 500,
          easing: config.animation.easing || "cubic",
        }
      : undefined,
  };

  return layout;
}

/**
 * Creates subplot layout configuration
 */
export function createSubplotLayout(config: PlotlyChartConfig): Partial<Layout> {
  const baseLayout = createBaseLayout(config);
  const subplot = config.subplot;

  if (!subplot) return baseLayout;

  return {
    ...baseLayout,
    // Note: Full subplot implementation would require more complex layout handling
    // For now, we'll focus on the core functionality
  };
}

/**
 * Generates subplot names for grid layout
 */
function generateSubplotNames(rows: number, cols: number): string[][] {
  const subplots: string[][] = [];
  let counter = 1;

  for (let row = 0; row < rows; row++) {
    const rowSubplots: string[] = [];
    for (let col = 0; col < cols; col++) {
      rowSubplots.push(counter === 1 ? "xy" : `x${counter}y${counter}`);
      counter++;
    }
    subplots.push(rowSubplots);
  }

  return subplots;
}

/**
 * Creates 3D-specific layout from PlotlyChartConfig
 */
export function create3DLayout(config: PlotlyChartConfig): Partial<Layout> {
  const baseLayout = createBaseLayout(config);
  const { xAxisTitle, yAxis = [], zAxisTitle, theme = "light" } = config;

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const textColor = isDark ? "#ffffff" : "#000000";

  return {
    ...baseLayout,
    scene: {
      xaxis: {
        title: { text: xAxisTitle || "X Axis" },
        color: textColor,
        gridcolor: gridColor,
        showgrid: true,
        showline: true,
        linecolor: gridColor,
      },
      yaxis: {
        title: { text: yAxis[0]?.title || "Y Axis" },
        color: textColor,
        gridcolor: gridColor,
        showgrid: true,
        showline: true,
        linecolor: gridColor,
      },
      zaxis: {
        title: { text: zAxisTitle || "Z Axis" },
        color: textColor,
        gridcolor: gridColor,
        showgrid: true,
        showline: true,
        linecolor: gridColor,
      },
      bgcolor: typeof baseLayout.plot_bgcolor === "string" ? baseLayout.plot_bgcolor : undefined,
      camera: {
        eye: { x: 1.25, y: 1.25, z: 1.25 },
      },
    },
  };
}

/**
 * Creates Plotly config object from PlotlyChartConfig with enhanced error handling
 */
export function createPlotlyConfig(config: PlotlyChartConfig): Partial<Config> {
  const {
    showModeBar = true,
    modeBarStyle = "default",
    downloadFilename = "plot",
    imageFormat = "png",
    responsive = true,
  } = config;

  // Validate dimensions for image exports
  const { width: safeWidth, height: safeHeight } = validateDimensions(config.width, config.height);

  const getModeBarConfig = () => {
    if (!showModeBar) return { displayModeBar: false };

    switch (modeBarStyle) {
      case "minimal":
        return {
          displayModeBar: true,
          modeBarButtonsToRemove: [
            "lasso2d",
            "select2d",
            "autoScale2d",
            "resetScale2d",
            "hoverClosestCartesian",
            "hoverCompareCartesian",
            "toggleHover",
          ] as any,
          displaylogo: false,
        };
      case "transparent":
        return {
          displayModeBar: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"] as any,
          displaylogo: false,
        };
      default:
        return {
          displayModeBar: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"] as any,
          displaylogo: false,
        };
    }
  };

  return {
    ...getModeBarConfig(),
    responsive,
    // Enhanced error handling for WebGL
    plotGlPixelRatio: 1, // Prevent high DPI issues
    staticPlot: false,
    // Safe image export options
    toImageButtonOptions: {
      format: imageFormat,
      filename: downloadFilename,
      height: safeHeight,
      width: safeWidth,
      scale: 1,
    },
    // Performance optimizations
    doubleClick: "reset",
    showTips: false,
    ...config, // Allow override of any config option
  };
}
