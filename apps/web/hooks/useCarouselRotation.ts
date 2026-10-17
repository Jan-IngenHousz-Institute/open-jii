import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useEffect, useState } from "react";
import type { FocusEvent, PointerEvent } from "react";

/** The part of a carousel's API the rotation drives; Embla's API fits it. */
export interface RotatableCarousel {
  on: (event: "select", callback: () => void) => unknown;
  off: (event: "select", callback: () => void) => unknown;
  selectedScrollSnap: () => number;
  scrollSnapList: () => number[];
  scrollNext: (jump?: boolean) => void;
  scrollTo: (index: number, jump?: boolean) => void;
}

/**
 * Advances a carousel on a timer. It holds while a mouse is over it or focus is inside it,
 * and starts held for a reader who asked for less motion, whose slides then change without
 * sliding. The reader's own pause or play outranks all of that, which is what makes moving
 * content stoppable. Spread `holdHandlers` on an element around the slides and their controls.
 */
export function useCarouselRotation(api: RotatableCarousel | undefined, intervalMs: number) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [selected, setSelected] = useState(0);
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const [choice, setChoice] = useState<"auto" | "paused" | "playing">("auto");

  const isRunning = choice === "playing" || (choice === "auto" && !prefersReducedMotion);

  useEffect(() => {
    if (!api) {
      return;
    }

    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Keyed on the selected slide, so each slide gets the whole interval, picked by hand or not.
  useEffect(() => {
    const canAdvance =
      api !== undefined && isRunning && !isHovered && !isFocused && api.scrollSnapList().length > 1;
    if (!canAdvance) {
      return;
    }

    const timer = window.setTimeout(() => api.scrollNext(prefersReducedMotion), intervalMs);
    return () => window.clearTimeout(timer);
  }, [api, isRunning, isHovered, isFocused, selected, intervalMs, prefersReducedMotion]);

  const toggleRunning = () => setChoice(isRunning ? "paused" : "playing");
  const showSlide = (index: number) => api?.scrollTo(index, prefersReducedMotion);

  // A touch also fires pointer enter, with no leave until the next tap elsewhere, so only a
  // mouse counts as hovering.
  const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") {
      setHovered(true);
    }
  };
  const onPointerLeave = () => setHovered(false);
  const onFocus = () => setFocused(true);
  // Moving between slides and controls blurs one and focuses the next; only leaving counts.
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const isLeaving =
      !(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget);
    if (isLeaving) {
      setFocused(false);
    }
  };

  return {
    selected,
    isRunning,
    toggleRunning,
    showSlide,
    holdHandlers: { onPointerEnter, onPointerLeave, onFocus, onBlur },
  };
}
