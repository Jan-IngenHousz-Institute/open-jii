"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface StripOverflowItem {
  key: string;
  node: ReactNode;
}

interface UseStripOverflowArgs {
  items: StripOverflowItem[];
  trailingSafetyPx?: number;
}

interface UseStripOverflowResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  shadowItemsRef: React.RefObject<HTMLDivElement | null>;
  shadowMoreRef: React.RefObject<HTMLButtonElement | null>;
  splitAt: number;
}

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

    // The toolbar pill is `w-fit`, so the strip's own clientWidth tracks
    // whatever its visible items already occupy — a feedback loop that pins
    // `available` to the already-collapsed state. Anchor instead to the
    // pill's PARENT (the gradient body's max-w container) and subtract the
    // pill's non-strip siblings (icon, tabs, more menu, separators) so the
    // strip knows how wide it could actually grow.
    const toolbar = container.closest<HTMLElement>("[data-toolbar-shell]");
    const widthBudgetParent = toolbar?.parentElement ?? null;

    const recompute = () => {
      const itemWidths = readChildWidths(shadowItems);
      if (itemWidths.length === 0) {
        setSplitAt(0);
        return;
      }
      const moreWidth = shadowMoreRef.current?.offsetWidth ?? MORE_BUTTON_FALLBACK_PX;

      const baseAvailable =
        widthBudgetParent && toolbar
          ? widthBudgetParent.clientWidth - (toolbar.clientWidth - container.clientWidth)
          : container.clientWidth;
      const available = baseAvailable - trailingSafetyPx;

      setSplitAt(computeSplitIndex(itemWidths, available, moreWidth));
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    ro.observe(shadowItems);
    if (shadowMoreRef.current) ro.observe(shadowMoreRef.current);
    if (widthBudgetParent) ro.observe(widthBudgetParent);

    // Sync + RAF catches late layout settling (font load, tab-switch reflow).
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
