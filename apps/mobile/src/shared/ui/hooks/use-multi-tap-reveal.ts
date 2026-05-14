import { useState } from "react";
import { useMultiTapAction } from "~/hooks/use-multi-tap-action";

interface MultiTapRevealOptions {
  tapsRequired?: number;
  intervalMs?: number;
}

interface MultiTapRevealResult {
  isVisible: boolean;
  handleTap: () => void;
}

export function useMultiTapReveal(options?: MultiTapRevealOptions): MultiTapRevealResult {
  const [isVisible, setIsVisible] = useState(false);
  const handleTap = useMultiTapAction(() => setIsVisible(true), {
    tapsRequired: options?.tapsRequired ?? 4,
    intervalMs: options?.intervalMs,
  });

  return { isVisible, handleTap };
}
