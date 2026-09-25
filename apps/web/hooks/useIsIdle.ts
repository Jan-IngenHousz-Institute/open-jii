import { useEffect, useState } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "focus"];

/**
 * True once the page has gone `idleMs` without input, false again on the next input. Polls stop
 * on it, so a tab left open stops waking the SQL warehouse behind the data it shows.
 */
export function useIsIdle(idleMs = 10 * 60_000): boolean {
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    let timer = setTimeout(() => setIsIdle(true), idleMs);

    const onActivity = () => {
      clearTimeout(timer);
      setIsIdle(false);
      timer = setTimeout(() => setIsIdle(true), idleMs);
    };

    // Capture so scrolls inside panels count, although scroll events do not bubble.
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { capture: true, passive: true });
    }

    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, { capture: true });
      }
    };
  }, [idleMs]);

  return isIdle;
}
