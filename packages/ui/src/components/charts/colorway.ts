/**
 * The series palette for platform-defined charts, as data. Resolution lives in
 * `./utils` beside `readThemeColor`; this file stays import-free to avoid a cycle.
 *
 * Not for user-picked series colours, which are stored as user data.
 */

/**
 * The platform half, ordered so the earliest slots are the furthest apart: most
 * charts carry two or three series.
 *
 * Six, because separation holds above ΔE 10 through slot 6 and falls to 9.8 at
 * slot 7. `--destructive` and `--muted-foreground` are deliberately absent:
 * red means error and grey means muted everywhere else.
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
 * Frozen hex, so these do not follow a theme swap: a chart only reaches them
 * with seven or more series, and is directly labelled at that point.
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
