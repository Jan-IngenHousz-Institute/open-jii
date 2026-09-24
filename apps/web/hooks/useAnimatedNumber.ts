import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;

/**
 * `value`, counted from the number on screen to the new one over a moment when
 * it changes, so an updated count is noticed. A new `resetKey` (another
 * dataset, say) or a count filling in from zero is shown as it is, and so is
 * every change for a reader who asks for reduced motion.
 */
export function useAnimatedNumber(value: number, resetKey?: string): number {
  const [shown, setShown] = useState({ value, key: resetKey });
  const onScreen = useRef(value);
  const keyOnScreen = useRef(resetKey);

  const isNewSubject = shown.key !== resetKey;
  const isFillingIn = shown.value === 0 && value !== 0;
  if (isNewSubject || isFillingIn) {
    setShown({ value, key: resetKey });
  }

  useEffect(() => {
    const from = onScreen.current;
    const isJump = keyOnScreen.current !== resetKey || from === 0;
    keyOnScreen.current = resetKey;
    if (isJump || from === value) {
      onScreen.current = value;
      return;
    }

    const isInstant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();

    let frame = requestAnimationFrame(function step(now) {
      const progress = isInstant ? 1 : Math.min(1, (now - startedAt) / DURATION_MS);
      const next = Math.round(from + (value - from) * (1 - (1 - progress) ** 3));
      onScreen.current = next;
      setShown({ value: next, key: resetKey });
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [value, resetKey]);

  return shown.value;
}
