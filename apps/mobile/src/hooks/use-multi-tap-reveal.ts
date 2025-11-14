import { useState } from "react";

interface MultiTapRevealOptions {
  tapsRequired?: number;
  intervalMs?: number;
}

interface MultiTapRevealResult {
  isVisible: boolean;
  handleTap: () => void;
}

export function useMultiTapReveal(options?: MultiTapRevealOptions): MultiTapRevealResult {
  const tapsRequired = options?.tapsRequired ?? 4;
  const intervalMs = options?.intervalMs ?? 600;

  const [isVisible, setIsVisible] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  function handleTap() {
    const now = Date.now();
    const withinWindow = now - lastTapTime < intervalMs;
    const nextCount = withinWindow ? tapCount + 1 : 1;
    setTapCount(nextCount);
    setLastTapTime(now);
    if (nextCount >= tapsRequired) {
      setIsVisible(true);
      setTapCount(0);
      setLastTapTime(0);
    }
  }

  return { isVisible, handleTap };
}
