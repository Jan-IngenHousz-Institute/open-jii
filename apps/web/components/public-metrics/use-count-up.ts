"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 1200;

/**
 * Animates 0 → target once `active` turns true. Snaps straight to the target
 * when the environment lacks matchMedia or prefers reduced motion.
 */
export function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    const canAnimate =
      typeof window.matchMedia === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canAnimate) {
      setValue(target);
      return;
    }

    let frame = 0;
    // Anchored to the first frame's own timestamp: rAF timestamps and
    // performance.now() do not always share a time origin, and mixing them
    // yields negative progress.
    let start: number | null = null;

    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min((now - start) / DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active]);

  return value;
}
