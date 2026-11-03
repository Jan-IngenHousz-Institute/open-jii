"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "~/lib/reduced-motion";

import { IntakeBubble } from "./intake-bubble";
import type { Bubble } from "./intake-bubble";

const MINUTE_MS = 60_000;

// Keeps a busy platform to a gentle effect: on average one bubble a second at most.
const MIN_MEAN_GAP_MS = 1000;

// Arrivals are independent, so the gaps between them are exponential rather than even.
function waitForNextMeasurement(meanGapMs: number) {
  return -Math.log(1 - Math.random()) * meanGapMs;
}

// Clips what rises above the leaf short of the row's top divider.
const LAYER = "pointer-events-none absolute inset-0 [clip-path:inset(-1.5rem_-0.5rem_0_-0.5rem)]";

export function IntakeBubbles({ messagesPerMinute }: { messagesPerMinute: number | undefined }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const count = useRef(0);

  useEffect(() => {
    const isQuiet =
      messagesPerMinute === undefined || messagesPerMinute <= 0 || prefersReducedMotion();

    if (isQuiet) {
      return;
    }

    const meanGapMs = Math.max(MIN_MEAN_GAP_MS, MINUTE_MS / messagesPerMinute);
    let timer = window.setTimeout(release, waitForNextMeasurement(meanGapMs));

    function release() {
      count.current += 1;
      const bubble = {
        id: count.current,
        drift: Math.random() * 10 - 5,
        size: 4 + Math.random() * 4,
      };
      setBubbles((current) => [...current, bubble]);
      timer = window.setTimeout(release, waitForNextMeasurement(meanGapMs));
    }

    return () => window.clearTimeout(timer);
  }, [messagesPerMinute]);

  const pop = useCallback((id: number) => {
    setBubbles((current) => current.filter((bubble) => bubble.id !== id));
  }, []);

  return (
    <span aria-hidden className={LAYER}>
      {bubbles.map((bubble) => (
        <IntakeBubble key={bubble.id} bubble={bubble} onDone={pop} />
      ))}
    </span>
  );
}
