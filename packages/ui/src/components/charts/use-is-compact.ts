"use client";

import { useEffect, useRef, useState } from "react";

// Four stacked breakpoints (`snug` includes `compact` includes
// `veryCompact` includes `ultraCompact`); consumers check most-aggressive
// first.
//
// - `snug`: medium widgets where typography can shrink slightly.
// - `compact`: legend drops to the bottom when a colorbar is present.
// - `veryCompact`: modebar gone, smallest fonts.
// - `ultraCompact`: faceted-cell tier where the wrapper forces a minimal
//   layout regardless of user prefs.
//
// Outer-container breakpoints, calibrated for a whole chart with chart
// chrome alongside the plot area.
const SNUG_BREAKPOINT = { width: 720, height: 480 };
const COMPACT_BREAKPOINT = { width: 480, height: 320 };
const VERY_COMPACT_BREAKPOINT = { width: 280, height: 200 };
const ULTRA_COMPACT_BREAKPOINT = { width: 200, height: 140 };

// Cell-level breakpoints, calibrated for a single cell of a facet grid
// which doesn't carry chart-level chrome. A 280x200 cell is roughly the
// same readability as a 480x320 whole-chart.
const CELL_SNUG_BREAKPOINT = { width: 480, height: 320 };
const CELL_COMPACT_BREAKPOINT = { width: 320, height: 220 };
const CELL_VERY_COMPACT_BREAKPOINT = { width: 160, height: 110 };
const CELL_ULTRA_COMPACT_BREAKPOINT = { width: 120, height: 80 };

export interface ChartSizing {
  // OUTER tiers, measured against the chart container. Drive chart-level
  // chrome: legend position, modebar, chart title, top-level margins.

  /** Lightly trimmed typography, modebar on hover, slimmer colorbar. */
  snug: boolean;
  /** On top of snug: legend forced to bottom when a colorbar is present. */
  compact: boolean;
  /** On top of compact: modebar gone, smallest fonts, tightest margins. */
  veryCompact: boolean;
  /** On top of veryCompact; outer container is itself tiny. */
  ultraCompact: boolean;

  // CELL tiers, measured against per-cell area when a facet grid is
  // configured. Drive axis chrome: tick fonts, axis titles, tick density,
  // per-cell title annotations.

  cellSnug: boolean;
  cellCompact: boolean;
  cellVeryCompact: boolean;
  /**
   * Forces the wrapper into minimal layout for that cell: axis titles
   * dropped, cell titles suppressed, ticks minimised.
   */
  cellUltraCompact: boolean;
}

interface BreakpointSet {
  snug: { width: number; height: number };
  compact: { width: number; height: number };
  veryCompact: { width: number; height: number };
  ultraCompact: { width: number; height: number };
}

const OUTER_BREAKPOINTS: BreakpointSet = {
  snug: SNUG_BREAKPOINT,
  compact: COMPACT_BREAKPOINT,
  veryCompact: VERY_COMPACT_BREAKPOINT,
  ultraCompact: ULTRA_COMPACT_BREAKPOINT,
};

const CELL_BREAKPOINTS: BreakpointSet = {
  snug: CELL_SNUG_BREAKPOINT,
  compact: CELL_COMPACT_BREAKPOINT,
  veryCompact: CELL_VERY_COMPACT_BREAKPOINT,
  ultraCompact: CELL_ULTRA_COMPACT_BREAKPOINT,
};

function tierFlags(
  width: number,
  height: number,
  bps: BreakpointSet,
): {
  snug: boolean;
  compact: boolean;
  veryCompact: boolean;
  ultraCompact: boolean;
} {
  return {
    snug: width < bps.snug.width || height < bps.snug.height,
    compact: width < bps.compact.width || height < bps.compact.height,
    veryCompact: width < bps.veryCompact.width || height < bps.veryCompact.height,
    ultraCompact: width < bps.ultraCompact.width || height < bps.ultraCompact.height,
  };
}

interface UseChartSizingOptions {
  /**
   * Divide the measured container size by this grid before comparing to
   * breakpoints. Used by faceted charts: a 800×500 container split into
   * a 4×2 grid has cells of ~200×250 each, which lands in the compact
   * tier even though the outer container is full-size. Without this
   * divisor, faceted charts would render with full-tier axis fonts and
   * margins inside cells that are physically too small to host them.
   *
   * Pass `{ rows: 1, columns: 1 }` (or omit) for unfaceted charts.
   */
  grid?: { rows: number; columns: number };
}

/**
 * Watch a DOM element and emit responsive tier flags. When `options.grid`
 * is set, the comparison runs against per-cell size so faceted cells each
 * shrink to fit. State only updates on tier flips.
 */
export function useChartSizing<T extends HTMLElement>(
  options: UseChartSizingOptions = {},
): readonly [React.RefObject<T | null>, ChartSizing] {
  const ref = useRef<T>(null);
  const [sizing, setSizing] = useState<ChartSizing>({
    snug: false,
    compact: false,
    veryCompact: false,
    ultraCompact: false,
    cellSnug: false,
    cellCompact: false,
    cellVeryCompact: false,
    cellUltraCompact: false,
  });

  // Pull the grid into local primitives so the effect deps stay stable
  // when the caller re-creates the options object on every render.
  const gridRows = options.grid?.rows ?? 1;
  const gridCols = options.grid?.columns ?? 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (width: number, height: number) => {
      // Outer-container tier (legend / modebar / chart title / margins).
      const outer = tierFlags(width, height, OUTER_BREAKPOINTS);
      // Cell tier (axis chrome / per-cell titles). `Math.max(1, ...)`
      // guards against a 0-row / 0-column grid producing Infinity.
      const cellWidth = width / Math.max(1, gridCols);
      const cellHeight = height / Math.max(1, gridRows);
      // Faceted cells use the tighter cell breakpoints; unfaceted (1x1)
      // falls back to OUTER_BREAKPOINTS so cell tiers mirror outer.
      const isFaceted = gridRows * gridCols > 1;
      const cell = tierFlags(
        cellWidth,
        cellHeight,
        isFaceted ? CELL_BREAKPOINTS : OUTER_BREAKPOINTS,
      );
      setSizing((prev) =>
        prev.snug === outer.snug &&
        prev.compact === outer.compact &&
        prev.veryCompact === outer.veryCompact &&
        prev.ultraCompact === outer.ultraCompact &&
        prev.cellSnug === cell.snug &&
        prev.cellCompact === cell.compact &&
        prev.cellVeryCompact === cell.veryCompact &&
        prev.cellUltraCompact === cell.ultraCompact
          ? prev
          : {
              snug: outer.snug,
              compact: outer.compact,
              veryCompact: outer.veryCompact,
              ultraCompact: outer.ultraCompact,
              cellSnug: cell.snug,
              cellCompact: cell.compact,
              cellVeryCompact: cell.veryCompact,
              cellUltraCompact: cell.ultraCompact,
            },
      );
    };

    const rect = el.getBoundingClientRect();
    update(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [gridRows, gridCols]);

  return [ref, sizing] as const;
}

/** Tier-derived layout values for facet grids. */
export interface FacetTierStyles {
  /** Per-cell facet title annotation font size. */
  cellTitleFontSize: number;
}

export function facetTierStyles(sizing: ChartSizing): FacetTierStyles {
  const cellTitleFontSize = sizing.cellVeryCompact
    ? 9
    : sizing.cellCompact
      ? 10
      : sizing.cellSnug
        ? 11
        : 12;
  return { cellTitleFontSize };
}

/** @deprecated kept for the previous `compact: boolean` callsites. */
export function useIsCompact<T extends HTMLElement>(): readonly [
  React.RefObject<T | null>,
  boolean,
] {
  const [ref, sizing] = useChartSizing<T>();
  return [ref, sizing.compact] as const;
}
