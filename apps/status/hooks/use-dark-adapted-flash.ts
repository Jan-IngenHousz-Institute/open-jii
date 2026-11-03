"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { prefersReducedMotion } from "~/lib/reduced-motion";

import { useTheme } from "@repo/ui/components/theme";

// The usual dark adaptation before an Fv/Fm reading.
const DARK_ADAPTATION_MS = 20 * 60_000;

// Chlorophyll fluorescence peaks near 685 nm.
const FLUORESCENCE = "oklch(0.55 0.22 27)";

// The OJIP rise (Fo, the J and I steps, the P peak) and the slow fall after it, squeezed into 3.6 s.
const OJIP: { offset: number; glow: number }[] = [
  { offset: 0, glow: 0.3 },
  { offset: 0.03, glow: 0.6 },
  { offset: 0.08, glow: 0.8 },
  { offset: 0.17, glow: 1 },
  { offset: 0.45, glow: 0.5 },
  { offset: 1, glow: 0 },
];

const FLASH: Keyframe[] = OJIP.map(({ offset, glow }) => ({
  offset,
  color: `color-mix(in oklch, ${FLUORESCENCE} ${glow * 100}%, var(--status-active-foreground))`,
  filter: `drop-shadow(0 0 ${glow * 6}px ${FLUORESCENCE})`,
}));

export function useDarkAdaptedFlash(target: RefObject<SVGSVGElement | null>) {
  const { resolvedTheme } = useTheme();
  const darkSince = useRef<number | null>(null);

  useEffect(() => {
    if (resolvedTheme === "dark") {
      darkSince.current = Date.now();
      return;
    }

    const isDarkAdapted =
      darkSince.current !== null && Date.now() - darkSince.current >= DARK_ADAPTATION_MS;
    darkSince.current = null;

    if (isDarkAdapted && !prefersReducedMotion()) {
      target.current?.animate(FLASH, { duration: 3600 });
    }
  }, [resolvedTheme, target]);
}
