import type { Config, Layout } from "plotly.js";

import type { PlotlyChartConfig, WebGLRenderer } from "./types";

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

// ISO 8601 date / datetime, with optional time, fractional seconds, and
// timezone. Loose enough to catch the common shapes that come back from
// Postgres / Databricks (e.g. `2025-08-26`, `2025-08-26 14:30:00`,
// `2025-08-26T14:30:00.123Z`).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Infer the right Plotly axis type for a column of values. Treating ISO
 * timestamps as `category` (the previous default) made each unique
 * timestamp a discrete bin and rotated hundreds of labels vertically;
 * `date` lets Plotly auto-bucket and tick at sensible intervals. Falls
 * back to `category` for genuinely-string columns and `linear` for
 * numeric or empty data.
 */
export function detectAxisType(values: ReadonlyArray<unknown>): "date" | "category" | "linear" {
  let sawAny = false;
  let allLookLikeDates = true;
  let sawNonNumericString = false;

  for (const v of values) {
    if (v == null || v === "") continue;
    sawAny = true;

    if (v instanceof Date) continue;

    if (typeof v === "string") {
      if (!ISO_DATE_RE.test(v)) {
        allLookLikeDates = false;
        if (Number.isNaN(Number(v))) sawNonNumericString = true;
      }
      continue;
    }

    // Number, bigint, etc.
    allLookLikeDates = false;
  }

  if (!sawAny) return "linear";
  if (allLookLikeDates) return "date";
  if (sawNonNumericString) return "category";
  return "linear";
}

/**
 * Creates base layout for all charts with PlotlyChartConfig
 */
export function createBaseLayout(config: PlotlyChartConfig): Partial<Layout> {
  const {
    theme,
    title,
    xAxisTitle,
    yAxisTitle,
    xAxisType = "linear",
    yAxisType = "linear",
    showLegend = true,
    showGrid = true,
    backgroundColor,
    annotations = [],
    shapes = [],
    hoverMode = "closest",
    dragMode = "zoom",
    legendPosition = "right",
  } = config;

  // Translate the user-facing position preset into Plotly's anchor model.
  // All three options sit OUTSIDE the data area; Plotly auto-reserves
  // margin so the legend never crops or overlaps points.
  const legendAnchor = (
    {
      right: { x: 1.02, y: 1, xanchor: "left", yanchor: "top", orientation: "v" },
      top: { x: 0.5, y: 1.1, xanchor: "center", yanchor: "bottom", orientation: "h" },
      bottom: { x: 0.5, y: -0.2, xanchor: "center", yanchor: "top", orientation: "h" },
    } as const
  )[legendPosition];

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

  return {
    title: title
      ? {
          text: title,
          font: { size: 14, family: "var(--font-inter), Inter, sans-serif", color: textColor },
        }
      : undefined,

    xaxis: {
      title: xAxisTitle
        ? { text: xAxisTitle, font: { size: 14, color: textColor, family: "var(--font-inter), Inter, sans-serif" } }
        : undefined,
      gridcolor: showGrid ? gridColor : "rgba(0,0,0,0)",
      showgrid: showGrid,
      type: xAxisType,
      color: textColor,
      showline: true,
      linecolor: gridColor,
      tickcolor: gridColor,
      automargin: true,
    },

    yaxis: {
      title: yAxisTitle
        ? { text: yAxisTitle, font: { size: 14, color: textColor, family: "var(--font-inter), Inter, sans-serif" } }
        : undefined,
      gridcolor: showGrid ? gridColor : "rgba(0,0,0,0)",
      showgrid: showGrid,
      type: yAxisType,
      color: textColor,
      showline: true,
      linecolor: gridColor,
      tickcolor: gridColor,
      automargin: true,
    },

    showlegend: showLegend,
    legend: {
      ...legendAnchor,
      bgcolor: isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)",
      bordercolor: gridColor,
      borderwidth: 1,
      font: { color: textColor, family: "var(--font-inter), Inter, sans-serif" },
    },

    // Reserve a fixed top strip so the modebar always has room. The chart
    // title (when present) renders into the same space, so we don't waste
    // vertical room when both are visible.
    margin: { l: 48, r: 24, t: 40, b: 36 },
    autosize: !width && !height, // Enable autosize when no fixed dimensions
    ...(width && { width }), // Only include width if it's defined
    ...(height && { height }), // Only include height if it's defined
    plot_bgcolor: bgColor,
    paper_bgcolor: paperBgColor,

    font: {
      family: "var(--font-inter), Inter, sans-serif",
      color: textColor,
      size: 12,
    },

    annotations: annotations.map((ann) => ({
      ...ann,
      font: {
        color: ann.font?.color || textColor,
        size: ann.font?.size || 12,
        family: ann.font?.family || "var(--font-inter), Inter, sans-serif",
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
  const { xAxisTitle, yAxisTitle, zAxisTitle, theme = "light" } = config;

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
        title: { text: yAxisTitle || "Y Axis" },
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
