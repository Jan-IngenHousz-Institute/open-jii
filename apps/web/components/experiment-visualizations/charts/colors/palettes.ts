// Color palettes + lookups for chart series and category encoding.

export const DEFAULT_PRIMARY_COLOR = "#3b82f6";

// Deterministic palette so adding a series doesn't produce non-reproducible
// autosave bodies (random hex per render would yield meaningless config diffs
// and unstable tests). Wraps once exhausted.
const SERIES_PALETTE = [
  DEFAULT_PRIMARY_COLOR,
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
] as const;

export function getDefaultSeriesColor(seriesIndex: number): string {
  return SERIES_PALETTE[seriesIndex % SERIES_PALETTE.length];
}

/** Categorical color palette (D3 schemeCategory10 + 10 lighter alternates). Wraps past 20. */
export const CATEGORY_PALETTE = [
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

/** Separator used to encode (seriesKey, categoryKey) pairs as flat colorMap
 *  keys. Picked for visual readability and rarity in real column / value
 *  names; the renderer falls back to the bare category key when no
 *  composite entry matches, so old single-series colorMaps keep working. */
export const COLOR_MAP_KEY_SEPARATOR = "::";

export function composeColorMapKey(seriesKey: string, categoryKey: string): string {
  return `${seriesKey}${COLOR_MAP_KEY_SEPARATOR}${categoryKey}`;
}

export function getCategoryColor(
  index: number,
  colorMap?: Record<string, string>,
  key?: string,
  seriesKey?: string,
): string {
  // Composite (`series::category`) override wins; falls back to plain
  // category override, then palette cycle. Charts with one Y series
  // never bother writing composite keys, so the fallback keeps them
  // working unchanged.
  if (key && colorMap) {
    if (seriesKey) {
      const composite = composeColorMapKey(seriesKey, key);
      const hit = colorMap[composite];
      if (hit) return hit;
    }
    const flat = colorMap[key];
    if (flat) return flat;
  }
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

/**
 * Pack a 3- or 6-digit hex color with an alpha channel into `rgba(...)`.
 * Used for translucent fills under solid outlines (KDE areas, sankey links,
 * stack fills). Passes the input through unchanged when it isn't a parseable
 * hex; returns `undefined` for `undefined` so callers stay opt-in.
 */
export function withAlpha(color: string, alpha: number): string;
export function withAlpha(color: string | undefined, alpha: number): string | undefined;
export function withAlpha(color: string | undefined, alpha: number): string | undefined {
  if (color === undefined) {
    return undefined;
  }
  const hex3Or6 = color.length === 4 || color.length === 7;
  if (!color.startsWith("#") || !hex3Or6) {
    return color;
  }
  const expanded =
    color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  const r = parseInt(expanded.slice(1, 3), 16);
  const g = parseInt(expanded.slice(3, 5), 16);
  const b = parseInt(expanded.slice(5, 7), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return color;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
