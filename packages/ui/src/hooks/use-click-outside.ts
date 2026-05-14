"use client";

import { useEffect } from "react";

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

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  options: UseClickOutsideOptions = {},
): void {
  const { ignoreSelectors, enabled = true, onEscape } = options;
  useEffect(() => {
    if (!enabled) return;
    const ignore = [...RADIX_PORTAL_SELECTORS, ...(ignoreSelectors ?? [])];
    const onPointerDown = (e: PointerEvent) => {
      const root = ref.current;
      const target = e.target as HTMLElement | null;
      if (!root || !target) return;
      if (root.contains(target)) return;
      for (const selector of ignore) {
        if (target.closest(selector)) return;
      }
      handler();
    };
    document.addEventListener("pointerdown", onPointerDown);
    let onKeyDown: ((e: KeyboardEvent) => void) | undefined;
    if (onEscape) {
      onKeyDown = (e) => {
        if (e.key === "Escape") onEscape();
      };
      document.addEventListener("keydown", onKeyDown);
    }
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      if (onKeyDown) document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, handler, enabled, onEscape, ignoreSelectors]);
}
