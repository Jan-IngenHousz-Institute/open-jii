/**
 * The series palette for platform-defined charts, as data. Resolution lives in
 * `./utils` beside `readThemeColor`; keeping this file import-free avoids a
 * cycle and leaves the palette itself reviewable in one place.
 *
 * Not for user-picked series colours: those are stored as user data, never
 * derived from here.
 */

/**
 * The platform half, ordered so the earliest slots are the furthest apart: most
 * charts carry two or three series, and those should get the most separable
 * colours rather than the first the theme happens to declare.
 *
 * Six, because that is where the platform runs out. Separation holds above
 * ΔE 10 through slot 6 and drops to 9.8 at slot 7; `--node-command` and
 * `--node-instruction` sit at ΔE 3.8 and 3.0 from `--chart-1` and `--chart-3`,
 * so adding them would buy slots that read as repeats.
 *
 * `--destructive` and `--muted-foreground` are deliberately absent: red means
 * error and grey means muted everywhere else, and a series should not inherit
 * that by landing in slot N.
 */
export const PLATFORM_SERIES_TOKENS = [
  "--chart-1",
  "--chart-4",
  "--node-question",
  "--chart-2",
  "--node-measurement",
  "--node-branch",
] as const;

/** Light-mode values, for SSR and jsdom where there is no computed style. */
export const PLATFORM_SERIES_FALLBACK = [
  "#005E5E",
  "#CAAC2F",
  "#A46282",
  "#05B047",
  "#657334",
  "#A9733A",
] as const;

/**
 * Plotly's own categorical palette, unchanged, for everything past the six.
 *
 * Frozen hex, so these do not follow a theme swap. That is the accepted trade:
 * a chart only reaches them with seven or more series, and such a chart is
 * always directly labelled.
 */
export const PLOTLY_SERIES_TAIL = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
  "#aec7e8",
  "#ffbb78",
  "#98df8a",
  "#ff9896",
  "#c5b0d5",
  "#c49c94",
  "#f7b6d2",
  "#c7c7c7",
  "#dbdb8d",
  "#9edae5",
] as const;

export const PLATFORM_SERIES_COUNT = PLATFORM_SERIES_TOKENS.length;
