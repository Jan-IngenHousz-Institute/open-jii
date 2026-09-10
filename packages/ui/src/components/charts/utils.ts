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

const OKLCH_RE =
  /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

const LAB_RE = /^lab\(\s*(-?[\d.]+%?)\s+(-?[\d.]+%?)\s+(-?[\d.]+%?)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

/** sRGB gamma encode, per CSS Color 4. Clamps first: a negative channel is
 * out of gamut, and `Math.pow` of one is NaN. */
function encodeChannel(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  const encoded =
    clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
}

/**
 * Converts an `oklch()` string to `#rrggbb`. Plotly paints to SVG and canvas
 * and parses colours itself, so it never sees a value CSS would resolve — the
 * theme's oklch has to be turned into sRGB here. Returns `undefined` for
 * anything that is not oklch; `readThemeColor` then tries `lab()`.
 */
export function oklchToHex(value: string): string | undefined {
  const match = OKLCH_RE.exec(value.trim());
  if (!match) return undefined;
  const [, rawL, rawC, rawH] = match;
  const lightness = rawL!.endsWith("%") ? Number.parseFloat(rawL!) / 100 : Number.parseFloat(rawL!);
  const chroma = Number.parseFloat(rawC!);
  const hue = (Number.parseFloat(rawH!) * Math.PI) / 180;
  if (!Number.isFinite(lightness) || !Number.isFinite(chroma) || !Number.isFinite(hue)) {
    return undefined;
  }

  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(encodeChannel);

  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** D50 white point, which CSS `lab()` is referred to. */
const LAB_D50: readonly [number, number, number] = [
  0.3457 / 0.3585,
  1.0,
  (1.0 - 0.3457 - 0.3585) / 0.3585,
];

/** Bradford chromatic adaptation, D50 -> D65. */
const BRADFORD_D50_TO_D65: readonly (readonly [number, number, number])[] = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.3303659366080753],
];

/** XYZ (D65) -> linear sRGB. */
const XYZ_D65_TO_LINEAR_SRGB: readonly (readonly [number, number, number])[] = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];

/**
 * Converts a CSS `lab()` string to `#rrggbb`. Needed because a custom property
 * registered by Tailwind as a `<color>` computes to `lab()`, not to the
 * `oklch()` it was authored as — so this is the form the theme actually arrives
 * in. CSS `lab()` is D50-referred, hence the Bradford adaptation before sRGB.
 */
export function labToHex(value: string): string | undefined {
  const match = LAB_RE.exec(value.trim());
  if (!match) return undefined;
  const [, rawL, rawA, rawB] = match;
  // `a`/`b` percentages are ±125 full-scale; lightness is 0-100.
  const lightness = rawL!.endsWith("%") ? Number.parseFloat(rawL!) : Number.parseFloat(rawL!);
  const aStar = rawA!.endsWith("%")
    ? (Number.parseFloat(rawA!) * 125) / 100
    : Number.parseFloat(rawA!);
  const bStar = rawB!.endsWith("%")
    ? (Number.parseFloat(rawB!) * 125) / 100
    : Number.parseFloat(rawB!);
  if (!Number.isFinite(lightness) || !Number.isFinite(aStar) || !Number.isFinite(bStar)) {
    return undefined;
  }

  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const fy = (lightness + 16) / 116;
  const fx = aStar / 500 + fy;
  const fz = fy - bStar / 200;
  const inverse = (f: number) => (f ** 3 > epsilon ? f ** 3 : (116 * f - 16) / kappa);

  const xyzD50: [number, number, number] = [
    inverse(fx) * LAB_D50[0],
    (lightness > kappa * epsilon ? ((lightness + 16) / 116) ** 3 : lightness / kappa) * LAB_D50[1],
    inverse(fz) * LAB_D50[2],
  ];
  const xyz = BRADFORD_D50_TO_D65.map(
    (row) => row[0] * xyzD50[0] + row[1] * xyzD50[1] + row[2] * xyzD50[2],
  );
  const channels = XYZ_D65_TO_LINEAR_SRGB.map((row) =>
    encodeChannel(row[0] * xyz[0]! + row[1] * xyz[1]! + row[2] * xyz[2]!),
  );

  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Colour forms Plotly's own parser understands. */
const PLOTLY_PARSEABLE = /^(#|rgba?\(|hsla?\(|[a-z]+$)/i;

/**
 * Reads a theme custom property off the document root and returns it as
 * something Plotly can parse, or `undefined`.
 *
 * Returning `undefined` matters: Plotly silently substitutes its own default
 * for a colour string it cannot read, so forwarding an unrecognised value
 * bypasses every caller's `?? "#fallback"` and fails invisibly. A token
 * registered by Tailwind computes to `lab()`, which Plotly cannot parse at all.
 */
export function readThemeColor(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return undefined;
  const converted = oklchToHex(raw) ?? labToHex(raw);
  if (converted) return converted;
  return PLOTLY_PARSEABLE.test(raw) ? raw : undefined;
}

/** Axis/grid rule colour, matching every other bordered surface. */
export function chartGridColor(): string {
  return readThemeColor("--border") ?? "#E6E6E6";
}

/**
 * The default colour for a reference line. One definition so the renderer, the
 * picker's fallback swatch and anything else agree.
 */
export function referenceLineColor(): string {
  return readThemeColor("--muted-foreground") ?? "#9ca3af";
}

/**
 * The series palette. Charts get their colours from the same `--chart-1..5`
 * block every other surface reads, so swapping the theme re-colours them too.
 * Falls back to Plotly's own palette when the properties are not readable.
 */
export function resolveChartColorway(): string[] | undefined {
  const colorway = [1, 2, 3, 4, 5]
    .map((index) => readThemeColor(`--chart-${index}`))
    .filter((color): color is string => color !== undefined);
  return colorway.length === 5 ? colorway : undefined;
}

// ISO 8601 (year, year-month, or date with optional time / fractional
// seconds / timezone). Year-month covers date_trunc('month', ...) output.
const ISO_DATE_RE =
  /^\d{4}(-\d{2}(-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?)?)?$/;

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

/** Sizing-tier flags shared by the tier-aware layout helpers. */
export interface ChartTierOptions {
  snug?: boolean;
  compact?: boolean;
  veryCompact?: boolean;
  ultraCompact?: boolean;
  cellSnug?: boolean;
  cellCompact?: boolean;
  cellVeryCompact?: boolean;
  cellUltraCompact?: boolean;
  hasColorbar?: boolean;
}

/** Max tick-label characters per cell tier before ellipsis kicks in. */
function tierMaxTickChars(options: ChartTierOptions): number {
  const cellVeryCompact = options.cellVeryCompact ?? options.veryCompact ?? false;
  const cellCompact = options.cellCompact ?? options.compact ?? cellVeryCompact;
  const cellSnug = options.cellSnug ?? options.snug ?? cellCompact;
  return cellVeryCompact ? 8 : cellCompact ? 12 : cellSnug ? 18 : 24;
}

/** Tick-count cap per cell tier; mirrors `createBaseLayout`'s `nticks`. */
function tierTickCap(options: ChartTierOptions): number | undefined {
  const cellVeryCompact = options.cellVeryCompact ?? options.veryCompact ?? false;
  const cellCompact = options.cellCompact ?? options.compact ?? cellVeryCompact;
  const cellSnug = options.cellSnug ?? options.snug ?? cellCompact;
  return cellVeryCompact ? 5 : cellCompact ? 8 : cellSnug ? 12 : undefined;
}

/** Ellipsize one tick label to the tier's char budget (for charts that build their own ticktext). */
export function truncateTickLabel(label: string, options: ChartTierOptions = {}): string {
  const maxChars = tierMaxTickChars(options);
  return label.length > maxChars ? `${label.slice(0, Math.max(1, maxChars - 1))}…` : label;
}

/**
 * Ellipsize long category tick labels so automargin cannot grow until the
 * plot area collapses. Array tick mode disables Plotly's nticks thinning,
 * so past the tier's tick cap every Nth category is sampled. Hover reads
 * point data, not ticktext. No-op on non-category axes, explicit ticks,
 * or when every label fits.
 */
export function truncateCategoryTicks(
  axis: Partial<LayoutAxis>,
  values: ReadonlyArray<unknown>,
  options: ChartTierOptions = {},
): Partial<LayoutAxis> {
  if (axis.type !== "category") return axis;
  if (axis.tickvals !== undefined || axis.ticktext !== undefined) return axis;

  const seen = new Set<string>();
  const categories: string[] = [];
  for (const v of values) {
    if (v == null || v === "") continue;
    const s = v instanceof Date ? v.toISOString() : String(v);
    if (seen.has(s)) continue;
    seen.add(s);
    categories.push(s);
  }

  const maxChars = tierMaxTickChars(options);
  const cap = tierTickCap(options);
  const needsTruncation = categories.some((c) => c.length > maxChars);
  const overCap = cap !== undefined && categories.length > cap;
  if (!needsTruncation && !overCap) return axis;

  // Sample in display order so array-mode ticks stay evenly spaced; tick
  // positions anchor by value, so order only affects sampling evenness.
  const order = typeof axis.categoryorder === "string" ? axis.categoryorder : "";
  const displayOrdered = order.startsWith("category")
    ? [...categories].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    : categories;
  if (order === "category descending") displayOrdered.reverse();

  const step =
    cap !== undefined && displayOrdered.length > cap ? Math.ceil(displayOrdered.length / cap) : 1;
  const sampled = displayOrdered.filter((_, i) => i % step === 0);

  return {
    ...axis,
    tickmode: "array",
    tickvals: sampled,
    ticktext: sampled.map((c) => truncateTickLabel(c, options)),
  };
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

type LegendPosition = NonNullable<PlotlyChartConfig["legendPosition"]>;

/** Map a legendPosition to its Plotly `layout.legend` anchor block.
 *  Shared with polar / radar / ternary / wind-rose so they get the same
 *  position dropdown as cartesian charts. `top` / `bottom` use container
 *  coords so the legend doesn't overlap axis tick / title bands. */
export function legendAnchorFor(position: LegendPosition) {
  const anchors = {
    right: { x: 1.02, y: 1, xanchor: "left", yanchor: "top", orientation: "v" },
    left: {
      x: 0,
      y: 1,
      xref: "container",
      xanchor: "left",
      yanchor: "top",
      orientation: "v",
    },
    top: {
      x: 0.5,
      y: 1,
      yref: "container",
      xanchor: "center",
      yanchor: "top",
      orientation: "h",
    },
    bottom: {
      x: 0.5,
      y: 0,
      yref: "container",
      xanchor: "center",
      yanchor: "bottom",
      orientation: "h",
    },
    "inside-top-right": {
      x: 0.98,
      y: 0.98,
      xanchor: "right",
      yanchor: "top",
      orientation: "v",
    },
    "inside-top-left": {
      x: 0.02,
      y: 0.98,
      xanchor: "left",
      yanchor: "top",
      orientation: "v",
    },
    "inside-bottom-right": {
      x: 0.98,
      y: 0.02,
      xanchor: "right",
      yanchor: "bottom",
      orientation: "v",
    },
    "inside-bottom-left": {
      x: 0.02,
      y: 0.02,
      xanchor: "left",
      yanchor: "bottom",
      orientation: "v",
    },
  } as const;
  return anchors[position];
}

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
    sparkline = false,
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
    !isInsideLegend && (ultraCompact || (compact && hasColorbar && legendPosition === "right"));
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
  const baseLegendAnchor = legendAnchorFor(effectiveLegendPosition);
  // When a colorbar shares the right gutter, push the legend a little
  // further out so it clears the colorbar bar and its rotated title.
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

  // Chrome colours come from the theme when the document is readable; the
  // scheme above stays as the server-render fallback.
  const gridColor = readThemeColor("--border") ?? colorScheme[theme ?? "auto"].grid;
  const textColor = readThemeColor("--foreground") ?? colorScheme[theme ?? "auto"].text;
  const bgColor = backgroundColor || "rgba(0,0,0,0)";
  const paperBgColor =
    backgroundColor || readThemeColor("--card") || colorScheme[theme ?? "auto"].bg;
  // Legend and annotation plates are a popover surface. `cc` is 0.8 alpha as an
  // 8-digit hex: Plotly parses that, and silently substitutes its own default
  // for a color-mix() it cannot read. isDark still supplies the SSR fallback.
  const plateBgColor = `${readThemeColor("--popover") ?? (isDark ? "#000000" : "#ffffff")}cc`;
  const colorway = resolveChartColorway();

  // Tier-aware typography. Axis chrome (tick fonts, axis title font,
  // tick density) keys off cell tiers so per-cell ticks shrink in faceted
  // charts. Chart chrome (legend, hover, chart title) keys off outer.
  const tickFont = {
    size: cellVeryCompact ? 9 : cellCompact ? 10 : cellSnug ? 11 : 12,
    color: textColor,
    family: "var(--font-sans)",
  };

  const axisTitleFont = {
    size: cellVeryCompact ? 10 : cellCompact ? 11 : cellSnug ? 13 : 14,
    color: textColor,
    family: "var(--font-sans)",
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
          font: {
            size: titleFontSize,
            family: "var(--font-sans)",
            color: textColor,
          },
        }
      : undefined,

    xaxis: {
      visible: !sparkline,
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
      visible: !sparkline,
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
      bgcolor: plateBgColor,
      bordercolor: gridColor,
      borderwidth: 1,
      // Keep emit order across stack modes; Plotly's default reverses it
      // for stacked traces.
      traceorder: "normal",
      font: {
        size: veryCompact ? 9 : compact ? 10 : snug ? 11 : 12,
        color: textColor,
        family: "var(--font-sans)",
      },
    },

    // Match hover-label font to the rest of the compact typography so
    // tooltips don't suddenly look oversized inside a tight widget.
    hoverlabel: {
      font: {
        size: veryCompact ? 10 : compact ? 11 : 12,
        family: "var(--font-sans)",
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
    ...(sparkline ? { margin: { l: 0, r: 0, t: 2, b: 2, pad: 0 } } : {}),
    autosize: !width && !height, // Enable autosize when no fixed dimensions
    ...(width && { width }), // Only include width if it's defined
    ...(height && { height }), // Only include height if it's defined
    plot_bgcolor: bgColor,
    paper_bgcolor: paperBgColor,
    ...(colorway && { colorway }),

    font: {
      family: "var(--font-sans)",
      color: textColor,
      size: 12,
    },

    annotations: annotations.map((ann) => ({
      ...ann,
      font: {
        color: ann.font?.color || textColor,
        size: ann.font?.size || 12,
        family: ann.font?.family || "var(--font-sans)",
      },
      bgcolor: ann.bgcolor || plateBgColor,
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
 * Coordinate-agnostic chrome slice of `createBaseLayout` (title, legend,
 * margins, autosize). Non-cartesian charts (polar / ternary / carpet)
 * spread this into their layouts without inheriting `xaxis` / `yaxis`.
 */
export function responsiveChrome(
  config: PlotlyChartConfig,
  options: ChartTierOptions = {},
): Partial<Layout> {
  const {
    title,
    showlegend,
    legend,
    hoverlabel,
    margin,
    autosize,
    width,
    height,
    paper_bgcolor,
    font,
    hovermode,
    dragmode,
  } = createBaseLayout(config, options);
  return {
    title,
    showlegend,
    legend,
    hoverlabel,
    margin,
    autosize,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    paper_bgcolor,
    font,
    hovermode,
    dragmode,
  };
}

/** Tick / axis-title font sizes for a tier; mirrors `createBaseLayout`'s axes. */
export function tierAxisFontSizes(options: ChartTierOptions = {}): {
  tick: number;
  axisTitle: number;
} {
  const veryCompact = options.veryCompact ?? false;
  const compact = options.compact ?? veryCompact;
  const snug = options.snug ?? compact;
  return {
    tick: veryCompact ? 9 : compact ? 10 : snug ? 11 : 12,
    axisTitle: veryCompact ? 10 : compact ? 11 : snug ? 13 : 14,
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
export function cellPosition(
  cellIndex: number,
  rows: number,
  columns: number,
): {
  row: number;
  column: number;
  isLastRow: boolean;
  isFirstColumn: boolean;
  isLastColumn: boolean;
} {
  const row = Math.floor(cellIndex / columns);
  const column = cellIndex % columns;
  return {
    row,
    column,
    isLastRow: row === rows - 1,
    isFirstColumn: column === 0,
    isLastColumn: column === columns - 1,
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
    /** cellUltraCompact tier: drop all axis / cell / shared titles, ticks only. */
    ultraCompactCells?: boolean;
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
  const ultraCompactCells = options.ultraCompactCells === true;
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
      title: sharedXTitleOn || ultraCompactCells ? undefined : isLastRow ? xTitle : undefined,
    };
    // Y axis: same pattern, leftmost column carries the labels and title.
    const yOverrides: FacetAxisOverrides = {
      matches: !isFirstCell && options.sharedY !== false ? "y" : undefined,
      showticklabels: options.sharedY !== false ? isFirstColumn : undefined,
      title: sharedYTitleOn || ultraCompactCells ? undefined : isFirstColumn ? yTitle : undefined,
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
  const cellTitles = (ultraCompactCells ? [] : cells)
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
  if (!ultraCompactCells && sharedXTitleOn && xTitle?.text) {
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
  if (!ultraCompactCells && sharedYTitleOn && yTitle?.text) {
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
  if (!ultraCompactCells && (sharedXTitleOn || sharedYTitleOn)) {
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
    options.cells && options.cells.length > 0 ? options.cells : [{ xaxisId: "x", yaxisId: "y" }];

  const newShapes: Array<Record<string, unknown>> = [];
  const newAnnotations: Array<Record<string, unknown>> = [];
  const firstCell = cells[0];

  for (const line of referenceLines) {
    if (!Number.isFinite(line.value)) continue;
    const color = line.color ?? referenceLineColor();
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
