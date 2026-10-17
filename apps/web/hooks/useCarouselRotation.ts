import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useEffect, useState } from "react";

/** The part of a carousel's API the rotation drives; Embla's API fits it. */
export interface RotatableCarousel {
  on: (event: "select", callback: () => void) => unknown;
  off: (event: "select", callback: () => void) => unknown;
  selectedScrollSnap: () => number;
  scrollSnapList: () => number[];
  scrollNext: () => void;
}

/**
 * Advances a carousel on a timer. It holds while the pointer or focus is on it, and starts
 * held for a reader who asked for less motion. The reader's own pause or play outranks both
 * of those, which is what makes moving content stoppable.
 */
export function useCarouselRotation(api: RotatableCarousel | undefined, intervalMs: number) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [selected, setSelected] = useState(0);
  const [isHeld, setHeld] = useState(false);
  const [choice, setChoice] = useState<"auto" | "paused" | "playing">("auto");

  const isRunning = choice === "playing" || (choice === "auto" && !prefersReducedMotion);

  useEffect(() => {
    if (!api) return;

    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Keyed on the selected slide, so each slide gets the whole interval, picked by hand or not.
  useEffect(() => {
    if (!api || !isRunning || isHeld || api.scrollSnapList().length < 2) return;

    const timer = window.setTimeout(() => api.scrollNext(), intervalMs);
    return () => window.clearTimeout(timer);
  }, [api, isRunning, isHeld, selected, intervalMs]);

  const toggleRunning = () => setChoice(isRunning ? "paused" : "playing");
  const hold = () => setHeld(true);
  const release = () => setHeld(false);

  return {
    selected,
    isRunning,
    toggleRunning,
    holdHandlers: {
      onMouseEnter: hold,
      onMouseLeave: release,
      onFocusCapture: hold,
      onBlurCapture: release,
    },
  };
}
