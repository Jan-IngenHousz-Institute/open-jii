import { useEffect, useRef, useState } from "react";
import type { FocusEvent, PointerEvent } from "react";

import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

interface UseRotationOptions {
  intervalMs: number;
  /** Moves to the next item. */
  onAdvance: () => void;
  /** The item showing; a change restarts the interval, so each item gets all of it. */
  position: number;
  /** False when there is nothing to move to, such as a single item. */
  canRotate: boolean;
}

/**
 * Content that moves on by itself every `intervalMs`, held while a mouse is over it or focus is
 * inside it, and started paused for a reader who asked for less motion. The reader's own pause
 * or play outranks all of that, which is what makes moving content stoppable. Spread
 * `holdHandlers` on the element around the content and its controls.
 *
 * `isRunning` is the reader's play or pause, for a toggle's label; `isRotating` is whether the
 * content moves right now, for whether a change should be announced.
 */
export function useRotation({ intervalMs, onAdvance, position, canRotate }: UseRotationOptions) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const [choice, setChoice] = useState<"auto" | "paused" | "playing">("auto");

  const isRunning = choice === "playing" || (choice === "auto" && !prefersReducedMotion);
  const isRotating = canRotate && isRunning && !isHovered && !isFocused;

  // A ref rather than useEffectEvent: React 19.2.3 never refreshes an effect event inside a
  // forwardRef or memo component, such as the carousel, which would keep its first callback.
  const latestAdvance = useRef(onAdvance);
  useEffect(() => {
    latestAdvance.current = onAdvance;
  });

  useEffect(() => {
    if (!isRotating) {
      return;
    }

    const timer = window.setTimeout(() => latestAdvance.current(), intervalMs);
    return () => window.clearTimeout(timer);
  }, [isRotating, position, intervalMs]);

  const toggleRunning = () => {
    if (isRunning) {
      setChoice("paused");
      return;
    }

    // Play is pressed from inside the held element, so it outranks the hold the press made.
    setHovered(false);
    setFocused(false);
    setChoice("playing");
  };

  // A touch also fires pointer enter, with no leave until the next tap elsewhere, so only a
  // mouse counts as hovering.
  const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") {
      setHovered(true);
    }
  };
  const onPointerLeave = () => setHovered(false);
  const onFocus = () => setFocused(true);
  // Moving between the content and its controls blurs one and focuses the next; only leaving
  // the element counts.
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const isLeaving =
      !(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget);
    if (isLeaving) {
      setFocused(false);
    }
  };

  return {
    isRunning,
    isRotating,
    toggleRunning,
    holdHandlers: { onPointerEnter, onPointerLeave, onFocus, onBlur },
  };
}
