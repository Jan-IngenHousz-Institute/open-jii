import type { RefObject } from "react";
import { useEffect, useState } from "react";

import type { CanvasBounds } from "../canvas/grid-backdrop";

export function useBackdropBounds(
  outerRef: RefObject<HTMLElement | null>,
  innerRef: RefObject<HTMLElement | null>,
): CanvasBounds | null {
  const [bounds, setBounds] = useState<CanvasBounds | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    const canObserve = typeof ResizeObserver !== "undefined";
    if (!outer || !inner || !canObserve) {
      return;
    }

    const measure = () => {
      const outerRect = outer.getBoundingClientRect();
      const innerRect = inner.getBoundingClientRect();
      const next: CanvasBounds = {
        canvasLeft: innerRect.left - outerRect.left,
        canvasTop: innerRect.top - outerRect.top,
        canvasWidth: innerRect.width,
        gradientWidth: outerRect.width,
        gradientHeight: outerRect.height,
      };
      setBounds((prev) => (boundsEqual(prev, next) ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [outerRef, innerRef]);

  return bounds;
}

function boundsEqual(a: CanvasBounds | null, b: CanvasBounds): boolean {
  if (!a) {
    return false;
  }
  return (
    a.canvasLeft === b.canvasLeft &&
    a.canvasTop === b.canvasTop &&
    a.canvasWidth === b.canvasWidth &&
    a.gradientWidth === b.gradientWidth &&
    a.gradientHeight === b.gradientHeight
  );
}
