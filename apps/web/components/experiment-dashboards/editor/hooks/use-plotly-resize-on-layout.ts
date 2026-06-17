"use client";

import { useEffect, useRef } from "react";

// Plotly only relayouts on `window.resize`; synthesize one whenever the
// container width changes so charts repaint to fit the new available area.
export function usePlotlyResizeOnLayout(width: number) {
  const prevWidthRef = useRef(width);
  useEffect(() => {
    if (prevWidthRef.current === width) {
      return;
    }
    prevWidthRef.current = width;
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    const timer = setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    return () => clearTimeout(timer);
  }, [width]);
}
