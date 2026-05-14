import type { Config, Layout, LayoutAxis } from "plotly.js";

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

// Refines an axis layout slice with a data-detected type, but only when
// the user hasn't explicitly chosen one. The default `linear` is treated
// as "no choice"; anything else (`date`, `category`, `log`) is honored.
export function refineAxisType(
  axis: Partial<LayoutAxis> | undefined,
  values: ReadonlyArray<unknown>,
): Partial<LayoutAxis> {
  const base = axis ?? {};
  if (base.type && base.type !== "linear") return base;
  const detected = detectAxisType(values);
  if (detected === "date") return { ...base, type: "date" };
  if (detected === "category") {
    return { ...base, type: "category", categoryorder: "category ascending" };
  }
  return base;
}

/**
 * Creates base layout for all charts with PlotlyChartConfig.
 *
 * Two responsive tiers:
 * - `compact`: smaller fonts, tighter margins, soft tick-label cap.
 * - `veryCompact`: on top of compact, drop axis titles, force legend
 *   to the bottom (overrides the user's legend position), and shrink
 *   the chart title.
 *
 * Both flags come from `useChartSizing` in each chart wrapper, so they
 * only flip when the container crosses a breakpoint; full-size charts
 * get the regular layout regardless.
 */
export function createBaseLayout(
  config: PlotlyChartConfig,
  options: {
    /** OUTER container tier (legend / modebar / chart title / chart margins). */
    snug?: boolean;
    compact?: boolean;
    veryCompact?: boolean;
    /**
     * CELL tiers (axis fonts, tick density, axis titles). Defaults to the
     * outer tier when omitted; faceted charts pass per-cell tiers so axis
     * styling shrinks to cell area while legend / modebar stay outer.
     */
    cellSnug?: boolean;
    cellCompact?: boolean;
    cellVeryCompact?: boolean;
    /**
     * Outermost tier (chart container scope only). When true, the wrapper
     * may override user-config that would visibly break in a tiny
     * container (e.g. force legend to bottom).
     */
    ultraCompact?: boolean;
    /**
     * The chart has a continuous-color colorbar that lives in the right
     * gutter, so the right-anchored legend can't sit at the same x. The
     * layout adjusts: at full size the legend nudges further right past
     * the colorbar; in compact tiers it anchors at the bottom instead.
     */
    hasColorbar?: boolean;
  } = {},
): Partial<Layout> {
  const veryCompact = options.veryCompact ?? false;
  const compact = options.compact ?? veryCompact;
  const snug = options.snug ?? compact;
  const ultraCompact = options.ultraCompact ?? false;
  // Cell tiers fall back to outer when caller doesn't differentiate.
  const cellVeryCompact = options.cellVeryCompact ?? veryCompact;
  const cellCompact = options.cellCompact ?? compact;
  const cellSnug = options.cellSnug ?? snug;
  const hasColorbar = options.hasColorbar ?? false;
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

  // Inside legends overlay the plot area and don't compete with axis
  // chrome, so the outside-position overrides below don't apply.
  const isInsideLegend = legendPosition.startsWith("inside-");
  // Two override paths apply only to outside positions:
  //  - ultraCompact: force "bottom" since other outside positions would
  //    push the plot region to zero width.
  //  - compact + colorbar + user-picked "right": force "bottom" since the
  //    right gutter is taken by the colorbar.
  // Otherwise respect the user's pick; compact tiers shrink fonts and
  // ticks but leave legend placement alone.
  const forceBottomLegend =
    !isInsideLegend &&
    (ultraCompact || (compact && hasColorbar && legendPosition === "right"));
  const effectiveLegendPosition = forceBottomLegend ? "bottom" : legendPosition;
  // Anchor presets:
  //  - "right"/"left": paper coords, vertical legend in the side margin.
  //    Plotly's autoexpand reliably grows margin.r/margin.l to fit.
  //  - "top"/"bottom": `yref: "container"`. Paper coords would land in
  //    the axis-tick-label band because Plotly's `xaxis.automargin` and
  //    legend autoexpand don't coordinate; container coords route through
  //    `_reservedMargin` which composes additively.
  //  - "inside-*": paper coords inside the plot area, anchored to a
  //    corner. Slight inset (0.02 / 0.98) keeps the legend off the axis
  //    spines.
  const baseLegendAnchor = (
    {
      right: { x: 1.02, y: 1, xanchor: "left", yanchor: "top", orientation: "v" } as const,
      // Y axis ticks + title also live in `margin.l`. Paper coords reconcile
      // with axis automargin via `max` and end up sharing the same band,
      // overlapping the ticks; container coords route through
      // `_reservedMargin` which composes additively.
      left: {
        x: 0,
        y: 1,
        xref: "container" as const,
        xanchor: "left" as const,
        yanchor: "top" as const,
        orientation: "v" as const,
      },
      top: {
        x: 0.5,
        y: 1,
        yref: "container" as const,
        xanchor: "center" as const,
        yanchor: "top" as const,
        orientation: "h" as const,
      },
      bottom: {
        x: 0.5,
        y: 0,
        yref: "container" as const,
        xanchor: "center" as const,
        yanchor: "bottom" as const,
        orientation: "h" as const,
      },
      "inside-top-right": {
        x: 0.98,
        y: 0.98,
        xanchor: "right" as const,
        yanchor: "top" as const,
        orientation: "v" as const,
      },
      "inside-top-left": {
        x: 0.02,
        y: 0.98,
        xanchor: "left" as const,
        yanchor: "top" as const,
        orientation: "v" as const,
      },
      "inside-bottom-right": {
        x: 0.98,
        y: 0.02,
        xanchor: "right" as const,
        yanchor: "bottom" as const,
        orientation: "v" as const,
      },
      "inside-bottom-left": {
        x: 0.02,
        y: 0.02,
        xanchor: "left" as const,
        yanchor: "bottom" as const,
        orientation: "v" as const,
      },
    } as const
  )[effectiveLegendPosition];
  // When a colorbar shares the right gutter, push the legend a little
  // further out: `x: 1.18` clears the colorbar bar AND its rotated
  // title text (default ~50px combined past plot edge).
  const legendAnchor =
    hasColorbar && effectiveLegendPosition === "right"
      ? { ...baseLegendAnchor, x: 1.18 }
      : baseLegendAnchor;

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

  // Tier-aware typography. Axis chrome (tick fonts, axis title font,
  // tick density) keys off cell tiers so per-cell ticks shrink in faceted
  // charts. Chart chrome (legend, hover, chart title) keys off outer.
  const tickFont = {
    size: cellVeryCompact ? 9 : cellCompact ? 10 : cellSnug ? 11 : 12,
    color: textColor,
    family: "var(--font-inter), Inter, sans-serif",
  };

  const axisTitleFont = {
    size: cellVeryCompact ? 10 : cellCompact ? 11 : cellSnug ? 13 : 14,
    color: textColor,
    family: "var(--font-inter), Inter, sans-serif",
  };
  // Chart-level title (outer tier; sits above the whole canvas).
  const titleFontSize = veryCompact ? 11 : compact ? 12 : snug ? 13 : 14;
  // Cap tick-label count in compact cell tiers. Plotly auto-caps date/
  // linear axes; this mostly bites on category axes where Plotly draws
  // every distinct value by default.
  const compactNticks = cellVeryCompact ? 5 : cellCompact ? 8 : cellSnug ? 12 : undefined;
  // Shorter tick marks per cell.
  const tickLen = cellCompact ? 3 : cellSnug ? 4 : undefined;

  return {
    title: title
      ? {
          text: title,
          font: { size: titleFontSize, family: "var(--font-inter), Inter, sans-serif", color: textColor },
        }
      : undefined,

    xaxis: {
      title: xAxisTitle ? { text: xAxisTitle, font: axisTitleFont } : undefined,
      gridcolor: showGrid ? gridColor : "rgba(0,0,0,0)",
      showgrid: showGrid,
      type: xAxisType,
      color: textColor,
      showline: true,
      linecolor: gridColor,
      tickcolor: gridColor,
      tickfont: tickFont,
      automargin: true,
      ...(compactNticks !== undefined ? { nticks: compactNticks } : {}),
      ...(tickLen !== undefined ? { ticklen: tickLen } : {}),
    },

    yaxis: {
      title: yAxisTitle ? { text: yAxisTitle, font: axisTitleFont } : undefined,
      gridcolor: showGrid ? gridColor : "rgba(0,0,0,0)",
      showgrid: showGrid,
      type: yAxisType,
      color: textColor,
      showline: true,
      linecolor: gridColor,
      tickcolor: gridColor,
      tickfont: tickFont,
      automargin: true,
      ...(compactNticks !== undefined ? { nticks: compactNticks } : {}),
      ...(tickLen !== undefined ? { ticklen: tickLen } : {}),
    },

    showlegend: showLegend,
    legend: {
      ...legendAnchor,
      bgcolor: isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)",
      bordercolor: gridColor,
      borderwidth: 1,
      font: {
        size: veryCompact ? 9 : compact ? 10 : snug ? 11 : 12,
        color: textColor,
        family: "var(--font-inter), Inter, sans-serif",
      },
    },

    // Match hover-label font to the rest of the compact typography so
    // tooltips don't suddenly look oversized inside a tight widget.
    hoverlabel: {
      font: {
        size: veryCompact ? 10 : compact ? 11 : 12,
        family: "var(--font-inter), Inter, sans-serif",
      },
    },

    // Margin floors per tier; `automargin: true` grows these to fit ticks
    // / titles. Top/bottom legends use `yref: "container"` and won't
    // auto-expand the margin, so these floors reserve a band big enough
    // for the legend alongside axis ticks / modebar.
    margin: (() => {
      const base = veryCompact
        ? { l: 24, r: 8, t: 16, b: 20 }
        : compact
          ? { l: 32, r: 16, t: 32, b: 28 }
          : snug
            ? { l: 40, r: 20, t: 36, b: 32 }
            : { l: 48, r: 24, t: 40, b: 36 };
      if (!showLegend) return base;
      // Inside legends sit on top of the plot; no dedicated margin.
      if (effectiveLegendPosition.startsWith("inside-")) return base;
      if (effectiveLegendPosition === "bottom") {
        return { ...base, b: Math.max(base.b, 64) };
      }
      if (effectiveLegendPosition === "top") {
        return { ...base, t: Math.max(base.t, 56) };
      }
      if (effectiveLegendPosition === "left") {
        return { ...base, l: Math.max(base.l, 80) };
      }
      return base;
    })(),
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
 * Creates Plotly config object from PlotlyChartConfig with enhanced error handling.
 *
 * `options.snug` and `options.compact` keep the modebar but switch it to
 * hover-only so it doesn't sit permanently in the chart's top strip.
 * `options.veryCompact` removes it altogether; buttons would crowd a
 * 230x170 widget and zoom/pan via scroll/drag still work.
 */
export function createPlotlyConfig(
  config: PlotlyChartConfig,
  options: { snug?: boolean; compact?: boolean; veryCompact?: boolean } = {},
): Partial<Config> {
  const {
    showModeBar = true,
    modeBarStyle = "default",
    downloadFilename = "plot",
    imageFormat = "png",
    responsive = true,
  } = config;
  const veryCompact = options.veryCompact ?? false;
  const compact = options.compact ?? veryCompact;
  const snug = options.snug ?? compact;

  // Validate dimensions for image exports
  const { width: safeWidth, height: safeHeight } = validateDimensions(config.width, config.height);

  const getModeBarConfig = () => {
    if (!showModeBar) return { displayModeBar: false };
    if (veryCompact) return { displayModeBar: false, displaylogo: false };
    if (compact || snug) return { displayModeBar: "hover" as const, displaylogo: false };

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

/**
 * Compute the row index of a cell in a row-major facet grid. Used to
 * decide which cells should hide their X-axis tick labels (only the
 * bottom row keeps them when X is shared) and which should hide their
 * Y-axis title (only the leftmost column keeps it).
 */
function cellPosition(
  cellIndex: number,
  rows: number,
  columns: number,
): { row: number; column: number; isLastRow: boolean; isFirstColumn: boolean } {
  const row = Math.floor(cellIndex / columns);
  const column = cellIndex % columns;
  return {
    row,
    column,
    isLastRow: row === rows - 1,
    isFirstColumn: column === 0,
  };
}

/**
 * Per-cell axis config in a facet grid. Built from the base layout's
 * single-axis template, then overridden with cell-specific concerns:
 *  - `matches` to share scales with cell 0 (when `sharedX`/`sharedY`)
 *  - `showticklabels: false` for cells not on the bottom row / leftmost
 *    column (avoids redundant tick clutter when scales are shared)
 *  - `title: undefined` for non-edge cells (the axis title only renders
 *    on the leftmost column / bottom row to dedupe labelling)
 */
interface FacetAxisOverrides {
  matches?: string;
  showticklabels?: boolean;
  title?: { text: string; font?: unknown } | undefined;
}

function applyAxisOverrides(
  template: Record<string, unknown> | undefined,
  overrides: FacetAxisOverrides,
): Record<string, unknown> {
  // Spread first so the template's defaults (gridcolor, type, etc.)
  // come through, then layer the cell-specific overrides on top.
  const result: Record<string, unknown> = { ...(template ?? {}) };
  if (overrides.matches !== undefined) result.matches = overrides.matches;
  if (overrides.showticklabels !== undefined) {
    result.showticklabels = overrides.showticklabels;
  }
  if ("title" in overrides) result.title = overrides.title;
  return result;
}

/**
 * Extend a single-canvas layout with a facet grid spec. Reads the
 * existing `xaxis` / `yaxis` configs as style templates, generates
 * `xaxisN` / `yaxisN` per cell, attaches `layout.grid`, and emits one
 * annotation per cell title. Returns a new layout object; the input
 * isn't mutated.
 *
 * Does NOT touch `yaxis2` (the secondary-Y feature). Combining secondary
 * axes with facets is out of scope for v1; if both are configured the
 * caller's wiring should pick one.
 */
export function extendLayoutForFacets(
  baseLayout: Partial<Layout>,
  cells: Array<{ title: string; xaxisId: string; yaxisId: string }>,
  options: {
    rows: number;
    columns: number;
    sharedX?: boolean;
    sharedY?: boolean;
    /**
     * Render the X-axis title once below the whole grid (paper-anchored
     * annotation) instead of repeating it on every bottom-row cell. The
     * per-cell axis title is suppressed when on. Independent of
     * `sharedX`: the column meaning is the same even when ranges differ.
     */
    sharedXTitle?: boolean;
    /** Same idea for the Y axis: one title rotated 90° on the left. */
    sharedYTitle?: boolean;
    roworder?: "top to bottom" | "bottom to top";
    /**
     * Per-cell title font size. Falls back to 12 when unset. Faceted
     * charts pass the sizing tier (very-compact / compact / snug /
     * full) so titles shrink as cells get smaller.
     */
    titleFontSize?: number;
  },
): Partial<Layout> {
  const xTemplate = baseLayout.xaxis as Record<string, unknown> | undefined;
  const yTemplate = baseLayout.yaxis as Record<string, unknown> | undefined;
  // Pull the title objects off the templates so we can apply them only
  // to the leftmost column (Y) / bottom row (X) without mutating the
  // template itself.
  const xTitle = xTemplate?.title as { text: string; font?: unknown } | undefined;
  const yTitle = yTemplate?.title as { text: string; font?: unknown } | undefined;

  const out: Record<string, unknown> = { ...baseLayout };
  // Wipe the single-axis configs; they get replaced by xaxis/xaxis2/...
  // Plotly treats the bare `xaxis` as `xaxis1`, so cell 0 keeps the
  // unsuffixed key.
  delete out.xaxis;
  delete out.yaxis;

  // When titles are shared (single grid-level annotation), suppress the
  // per-cell axis title so it doesn't render on top of the shared one.
  const sharedXTitleOn = options.sharedXTitle === true;
  const sharedYTitleOn = options.sharedYTitle === true;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const { isLastRow, isFirstColumn } = cellPosition(i, options.rows, options.columns);
    const isFirstCell = i === 0;
    // X axis: cell 0 is the master; subsequent cells match it when
    // sharedX is true. Tick labels stay only on the bottom row of the
    // grid (when shared); otherwise every cell keeps its own labels.
    const xOverrides: FacetAxisOverrides = {
      matches: !isFirstCell && options.sharedX !== false ? "x" : undefined,
      showticklabels: options.sharedX !== false ? isLastRow : undefined,
      // X-axis title only on the bottom row when shared; otherwise on
      // every cell that's in the bottom row of its own column. When
      // `sharedXTitle` is on, suppress entirely (the grid emits a
      // single annotation below the whole canvas instead).
      title: sharedXTitleOn ? undefined : isLastRow ? xTitle : undefined,
    };
    // Y axis: same pattern, leftmost column carries the labels and title.
    const yOverrides: FacetAxisOverrides = {
      matches: !isFirstCell && options.sharedY !== false ? "y" : undefined,
      showticklabels: options.sharedY !== false ? isFirstColumn : undefined,
      title: sharedYTitleOn ? undefined : isFirstColumn ? yTitle : undefined,
    };
    // The unsuffixed `xaxis` / `yaxis` keys hold cell 0's config; the
    // numbered keys take cells 1..N-1. Plotly's grid pattern reads both.
    const xKey = cell.xaxisId === "x" ? "xaxis" : `xaxis${cell.xaxisId.slice(1)}`;
    const yKey = cell.yaxisId === "y" ? "yaxis" : `yaxis${cell.yaxisId.slice(1)}`;
    out[xKey] = applyAxisOverrides(xTemplate, xOverrides);
    out[yKey] = applyAxisOverrides(yTemplate, yOverrides);
  }

  out.grid = {
    rows: options.rows,
    columns: options.columns,
    pattern: "independent",
    roworder: options.roworder ?? "top to bottom",
  };

  // Per-cell title annotations positioned at the top of each cell. We
  // anchor to the cell's xaxis (`xref`) and use paper-coordinate y so
  // the title sits just above the plot region regardless of data range.
  const existingAnnotations =
    (baseLayout.annotations as Array<Record<string, unknown>> | undefined) ?? [];
  const cellTitleFontSize = options.titleFontSize ?? 12;
  const cellTitles = cells
    .filter((c) => c.title.length > 0)
    .map((cell) => ({
      text: cell.title,
      xref: `${cell.xaxisId} domain`,
      yref: `${cell.yaxisId} domain`,
      x: 0.5,
      y: 1.05,
      xanchor: "center",
      yanchor: "bottom",
      showarrow: false,
      font: { size: cellTitleFontSize },
    }));

  // Grid-level shared-title annotations. Paper-anchored so they sit in
  // the chart margin once, instead of repeating on each edge cell.
  // `yshift` / `xshift` push them outside the [0..1] paper area into
  // the margin band; the corresponding margin floors below ensure the
  // chart actually has that room. The font size mirrors the chart-level
  // axis-title scale (we read it off the base xaxis/yaxis title font
  // when present, else fall back to 14).
  const xTitleFont = (xTitle?.font as Record<string, unknown> | undefined) ?? { size: 14 };
  const yTitleFont = (yTitle?.font as Record<string, unknown> | undefined) ?? { size: 14 };
  const sharedTitles: Array<Record<string, unknown>> = [];
  if (sharedXTitleOn && xTitle?.text) {
    sharedTitles.push({
      text: xTitle.text,
      xref: "paper",
      yref: "paper",
      x: 0.5,
      y: 0,
      // ~50px below the bottom edge to clear tick labels on the bottom
      // row. Paired with margin.b floor below.
      yshift: -50,
      xanchor: "center",
      yanchor: "top",
      showarrow: false,
      font: xTitleFont,
    });
  }
  if (sharedYTitleOn && yTitle?.text) {
    sharedTitles.push({
      text: yTitle.text,
      xref: "paper",
      yref: "paper",
      x: 0,
      y: 0.5,
      xshift: -55,
      xanchor: "center",
      yanchor: "middle",
      // Vertical text matches Plotly's own y-axis title convention.
      textangle: -90,
      showarrow: false,
      font: yTitleFont,
    });
  }

  out.annotations = [...existingAnnotations, ...cellTitles, ...sharedTitles];

  // Bump margin floors so paper-anchored shared titles aren't clipped.
  // Plotly's annotations don't participate in `automargin`, so we have
  // to reserve the band ourselves.
  if (sharedXTitleOn || sharedYTitleOn) {
    const existingMargin = (out.margin as Record<string, number> | undefined) ?? {};
    out.margin = {
      ...existingMargin,
      ...(sharedXTitleOn ? { b: Math.max(existingMargin.b ?? 0, 90) } : {}),
      ...(sharedYTitleOn ? { l: Math.max(existingMargin.l ?? 0, 80) } : {}),
    };
  }

  return out as Partial<Layout>;
}

/**
 * Compute a default column count for a facet grid via
 * `Math.ceil(sqrt(n))`. Capped at the cell count so tiny grids don't
 * synthesise empty trailing cells.
 */
export function defaultFacetColumns(n: number): number {
  if (n <= 1) return 1;
  return Math.min(n, Math.ceil(Math.sqrt(n)));
}

/**
 * One static reference line: an axis-aligned marker for thresholds /
 * baselines / targets. `axis: "x"` is vertical at `value`, `axis: "y"`
 * is horizontal. Spans the cell's full opposite-axis domain.
 */
export interface ReferenceLineSpec {
  axis: "x" | "y";
  value: number;
  label?: string;
  color?: string;
  dash?: "solid" | "dash" | "dot" | "dashdot";
  width?: number;
}

/**
 * Materialise reference-line specs into Plotly shapes (and annotations
 * for labelled lines) and splice them into `layout`. For faceted charts,
 * pass the cells so the line repeats in every cell; labels are emitted
 * only on the first cell. No-op when `referenceLines` is empty.
 */
export function applyReferenceLines(
  layout: Partial<Layout>,
  referenceLines: ReadonlyArray<ReferenceLineSpec> | undefined,
  options: { cells?: ReadonlyArray<{ xaxisId: string; yaxisId: string }> } = {},
): void {
  if (!referenceLines || referenceLines.length === 0) return;
  const cells =
    options.cells && options.cells.length > 0
      ? options.cells
      : [{ xaxisId: "x", yaxisId: "y" }];

  const newShapes: Array<Record<string, unknown>> = [];
  const newAnnotations: Array<Record<string, unknown>> = [];
  const firstCell = cells[0];

  for (const line of referenceLines) {
    if (!Number.isFinite(line.value)) continue;
    const color = line.color ?? "#9ca3af";
    const dash = line.dash ?? "dash";
    const width = line.width ?? 1.5;

    for (const cell of cells) {
      if (line.axis === "x") {
        newShapes.push({
          type: "line",
          xref: cell.xaxisId,
          yref: `${cell.yaxisId} domain`,
          x0: line.value,
          x1: line.value,
          y0: 0,
          y1: 1,
          line: { color, width, dash },
          // Sit behind the data so points are still readable on top.
          layer: "below",
        });
      } else {
        newShapes.push({
          type: "line",
          xref: `${cell.xaxisId} domain`,
          yref: cell.yaxisId,
          x0: 0,
          x1: 1,
          y0: line.value,
          y1: line.value,
          line: { color, width, dash },
          layer: "below",
        });
      }
    }

    if (line.label && line.label.length > 0 && firstCell) {
      newAnnotations.push(
        line.axis === "x"
          ? {
              text: line.label,
              xref: firstCell.xaxisId,
              yref: `${firstCell.yaxisId} domain`,
              x: line.value,
              y: 1,
              xanchor: "left",
              yanchor: "top",
              xshift: 4,
              yshift: -4,
              showarrow: false,
              font: { size: 10, color },
            }
          : {
              text: line.label,
              xref: `${firstCell.xaxisId} domain`,
              yref: firstCell.yaxisId,
              x: 1,
              y: line.value,
              xanchor: "right",
              yanchor: "bottom",
              xshift: -4,
              yshift: 4,
              showarrow: false,
              font: { size: 10, color },
            },
      );
    }
  }

  if (newShapes.length > 0) {
    layout.shapes = [...(layout.shapes ?? []), ...newShapes] as Layout["shapes"];
  }
  if (newAnnotations.length > 0) {
    layout.annotations = [
      ...(layout.annotations ?? []),
      ...newAnnotations,
    ] as Layout["annotations"];
  }
}
