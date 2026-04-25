"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Hook for copying text to the clipboard with a temporary "copied" state.
 * Includes a fallback for environments where the Clipboard API is unavailable
 * (e.g. non-HTTPS contexts, older Firefox builds).
 */
export function useCopyToClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);

        if (timerRef.current) clearTimeout(timerRef.current);
        setCopied(true);
        timerRef.current = setTimeout(() => setCopied(false), resetDelay);
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
      }
    },
    [resetDelay],
  );

  return { copy, copied };
}
