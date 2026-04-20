import { useState } from "react";

interface MultiTapActionOptions {
  tapsRequired?: number;
  intervalMs?: number;
}

export function useMultiTapAction(
  onAction: () => void,
  options?: MultiTapActionOptions,
): () => void {
  const tapsRequired = options?.tapsRequired ?? 3;
  const intervalMs = options?.intervalMs ?? 600;

  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  return function handleTap() {
    const now = Date.now();
    const withinWindow = now - lastTapTime < intervalMs;
    const nextCount = withinWindow ? tapCount + 1 : 1;
    setTapCount(nextCount);
    setLastTapTime(now);
    if (nextCount >= tapsRequired) {
      setTapCount(0);
      setLastTapTime(0);
      onAction();
    }
  };
}
