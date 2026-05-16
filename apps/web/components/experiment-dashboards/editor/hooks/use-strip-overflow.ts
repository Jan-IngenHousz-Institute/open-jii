"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface StripOverflowItem {
  /** Stable key; used as React key and to keep shadow row aligned with the live row. */
  key: string;
  node: ReactNode;
}

interface UseStripOverflowArgs {
  items: StripOverflowItem[];
  /** Extra px reserved for sibling controls in the parent flex row. */
  trailingSafetyPx?: number;
}

interface UseStripOverflowResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  shadowItemsRef: React.RefObject<HTMLDivElement | null>;
  shadowMoreRef: React.RefObject<HTMLButtonElement | null>;
  /** Number of items that fit live; remainder goes into the More popover. */
  splitAt: number;
}

// Measures off-screen shadow item widths against the live container's
// clientWidth on every resize, then returns how many items fit before
// they must spill into the More popover. The caller owns rendering both
// the live row and the shadow mirror; this hook owns the imperative
// width math.
export function useStripOverflow({
  items,
  trailingSafetyPx = 0,
}: UseStripOverflowArgs): UseStripOverflowResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowItemsRef = useRef<HTMLDivElement>(null);
  const shadowMoreRef = useRef<HTMLButtonElement>(null);
  const [splitAt, setSplitAt] = useState(items.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const shadowItems = shadowItemsRef.current;
    if (!container || !shadowItems) return;

    const recompute = () => {
      const itemWidths = readChildWidths(shadowItems);
      if (itemWidths.length === 0) {
        setSplitAt(0);
        return;
      }
      // Container is `flex-1 min-w-0 overflow-hidden`, so clientWidth is
      // the space the strip actually gets after siblings claim theirs.
      const available = container.clientWidth - trailingSafetyPx;
      const moreWidth = shadowMoreRef.current?.offsetWidth ?? MORE_BUTTON_FALLBACK_PX;
      setSplitAt(computeSplitIndex(itemWidths, available, moreWidth));
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    ro.observe(shadowItems);
    if (shadowMoreRef.current) ro.observe(shadowMoreRef.current);

    // Sync + RAF pass catches late layout settling (font load, tab-switch
    // reflow) where the first read sees stale widths.
    recompute();
    const raf = requestAnimationFrame(recompute);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [items, trailingSafetyPx]);

  return { containerRef, shadowItemsRef, shadowMoreRef, splitAt };
}

const STRIP_GAP = 4;
// Fallback used only on the very first paint before the shadow More
// button has been measured. The shadow ref takes over after mount.
const MORE_BUTTON_FALLBACK_PX = 100;

function readChildWidths(parent: HTMLElement): number[] {
  return Array.from(parent.children)
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .map((el) => el.offsetWidth);
}

function computeSplitIndex(widths: number[], available: number, moreWidth: number): number {
  const naturalTotal = widths.reduce(
    (sum, width, idx) => sum + width + (idx > 0 ? STRIP_GAP : 0),
    0,
  );
  if (naturalTotal <= available) return widths.length;

  const budget = available - moreWidth - STRIP_GAP;
  let used = 0;
  let count = 0;
  for (let i = 0; i < widths.length; i++) {
    const itemWidth = widths[i] + (i > 0 ? STRIP_GAP : 0);
    if (used + itemWidth > budget) break;
    used += itemWidth;
    count++;
  }
  return count;
}
