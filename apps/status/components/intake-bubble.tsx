"use client";

import { useCallback } from "react";

export interface Bubble {
  id: number;
  drift: number;
  size: number;
}

export function IntakeBubble({ bubble, onDone }: { bubble: Bubble; onDone: (id: number) => void }) {
  const rise = useCallback(
    (element: HTMLSpanElement) => {
      const animation = element.animate(
        [
          { transform: "translate(-50%, 2px) scale(0.5)", opacity: 0 },
          { transform: "translate(-50%, -6px) scale(1)", opacity: 0.9, offset: 0.2 },
          { transform: `translate(calc(-50% + ${bubble.drift}px), -30px) scale(1.15)`, opacity: 0 },
        ],
        { duration: 2600, easing: "ease-out" },
      );
      animation.onfinish = () => onDone(bubble.id);

      return () => animation.cancel();
    },
    [bubble, onDone],
  );

  return (
    <span
      ref={rise}
      className="border-status-active-foreground bg-status-active/60 absolute left-1/2 top-0 rounded-full border"
      style={{ width: bubble.size, height: bubble.size }}
    />
  );
}
