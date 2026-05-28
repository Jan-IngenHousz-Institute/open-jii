"use client";

import { useEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Observe a DOM element's content-box size via `ResizeObserver`. Returns
 * `null` until the first measurement fires; falls back to a single
 * `getBoundingClientRect` read when `ResizeObserver` isn't available
 * (SSR / older test envs).
 */
export function useElementSize<T extends HTMLElement>(): readonly [
  React.RefObject<T | null>,
  ElementSize | null,
] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ElementSize | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof ResizeObserver === "undefined") {
      const rect = node.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
      return;
    }
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return [ref, size] as const;
}
