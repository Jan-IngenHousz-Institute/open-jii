"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

export interface UseClickOutsideOptions {
  /**
   * Selectors of ancestors that, when matched, should NOT trigger the
   * handler. Defaults cover the common Radix portal containers (popover,
   * select, dropdown menu) so a popover opened from inside `ref` doesn't
   * collapse its host on the very click that opens it.
   */
  ignoreSelectors?: string[];
  /** When false, the listener is detached. Lets callers gate by open-state. */
  enabled?: boolean;
  /** Also dismiss on `Escape` keydown. */
  onEscape?: () => void;
}

const RADIX_PORTAL_SELECTORS = [
  "[data-radix-popper-content-wrapper]",
  "[data-radix-popover-content]",
  "[data-radix-select-content]",
  "[data-radix-dropdown-menu-content]",
];

// Client components still SSR in Next.js, where useLayoutEffect warns.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  options: UseClickOutsideOptions = {},
): void {
  const { ignoreSelectors, enabled = true, onEscape } = options;

  // Callers pass fresh inline closures and array literals every render. Read
  // them through a ref so the document listeners subscribe once per
  // enabled-toggle instead of re-binding on each parent render.
  const latest = useRef({ handler, onEscape, ignoreSelectors });
  useIsoLayoutEffect(() => {
    latest.current = { handler, onEscape, ignoreSelectors };
  });

  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (e: PointerEvent) => {
      const root = ref.current;
      const target = e.target;
      // A target already detached from the document (an item that unmounts on
      // click) was inside a moment ago, so it is not an outside click.
      if (!root || !(target instanceof Node) || !target.isConnected) return;
      if (root.contains(target)) return;
      if (target instanceof Element) {
        const ignore = [...RADIX_PORTAL_SELECTORS, ...(latest.current.ignoreSelectors ?? [])];
        for (const selector of ignore) {
          if (target.closest(selector)) return;
        }
      }
      latest.current.handler();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current.onEscape?.();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, enabled]);
}
