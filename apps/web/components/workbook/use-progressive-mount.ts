import { startTransition, useCallback, useEffect, useState } from "react";

// At or below the size the server renders whole, every cell mounts at once, so a server-rendered
// workbook hydrates as it was sent.
const MOUNT_AT_ONCE_MAX = 100;
const BATCH = 40;

/**
 * How many of a long list's items to mount: the first batch at once and the rest a batch per task,
 * so a 900-cell workbook does not commit 100,000 elements in one task.
 */
export function useProgressiveMount(total: number): { mounted: number; mountAll: () => void } {
  const [startsWhole] = useState(total <= MOUNT_AT_ONCE_MAX);
  const [batches, setBatches] = useState(1);
  const [isForced, setIsForced] = useState(false);
  const isComplete = startsWhole || isForced || batches * BATCH >= total;

  useEffect(() => {
    if (isComplete) {
      return;
    }
    const timer = setTimeout(() => startTransition(() => setBatches((count) => count + 1)), 0);
    return () => clearTimeout(timer);
  }, [isComplete, batches]);

  const mountAll = useCallback(() => setIsForced(true), []);

  return { mounted: isComplete ? total : batches * BATCH, mountAll };
}
