"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "error";

interface UseAutosaveOptions<T> {
  value: T;
  toKey: (v: T) => string;
  save: (v: T) => Promise<void>;
  isValid?: (v: T) => boolean;
  delayMs?: number;
  flushOnUnmount?: boolean;
  /** Flipping false -> true rebases the saved anchor to the current value. */
  enabled?: boolean;
}

interface UseAutosaveReturn {
  status: AutosaveStatus;
  isDirty: boolean;
  isSaving: boolean;
  hasError: boolean;
  error: unknown;
  flush: (options?: { retryFailed?: boolean }) => Promise<void>;
  /**
   * `toKey` of the last value persisted. Compare against the current key to test
   * for unsaved work without the commit lag `status` has.
   */
  savedKey: string;
  /** Treat the current value as saved, for hosts that adopt a server copy. */
  rebase: () => void;
}

/**
 * Mount with the value already in its persisted state — the first render's
 * `toKey(value)` becomes the saved anchor.
 */
export function useAutosave<T>({
  value,
  toKey,
  save,
  isValid,
  delayMs = 1000,
  flushOnUnmount = true,
  enabled = true,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const key = useMemo(() => toKey(value), [value, toKey]);

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<unknown>(null);

  const lastSavedKeyRef = useRef(key);
  const wasEnabledRef = useRef(enabled);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const mountedRef = useRef(false);
  const delayMsRef = useRef(delayMs);
  delayMsRef.current = delayMs;

  const valueRef = useRef(value);
  const keyRef = useRef(key);
  const saveRef = useRef(save);
  const isValidRef = useRef(isValid);
  valueRef.current = value;
  keyRef.current = key;
  saveRef.current = save;
  isValidRef.current = isValid;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Survives the value-effect's re-render cleanup so the unmount-flush
  // effect can fire independently of cleanup ordering.
  const pendingFlushRef = useRef(false);

  // Guards against a slow save's late resolve clobbering newer state.
  const seqRef = useRef(0);
  const latestAppliedSeqRef = useRef(0);

  const inFlightRef = useRef<Promise<void> | null>(null);

  const scheduleSave = useCallback((run: () => Promise<void>, delay: number) => {
    pendingFlushRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void run();
    }, delay);
  }, []);

  const runSave = useCallback(
    async function runSave() {
      if (!enabledRef.current) return;
      const v = valueRef.current;
      const k = keyRef.current;

      if (isValidRef.current && !isValidRef.current(v)) return;
      if (k === lastSavedKeyRef.current) {
        pendingFlushRef.current = false;
        setStatus("idle");
        return;
      }

      pendingFlushRef.current = false;
      const seq = ++seqRef.current;
      setStatus("saving");
      setError(null);

      const promise = saveRef.current(v).then(
        () => {
          if (seq < latestAppliedSeqRef.current) return;
          latestAppliedSeqRef.current = seq;
          lastSavedKeyRef.current = k;
          const isSaved = keyRef.current === k;
          setStatus(isSaved ? "idle" : "dirty");
          if (
            !isSaved &&
            seq === seqRef.current &&
            timerRef.current === null &&
            enabledRef.current &&
            isValidRef.current?.(valueRef.current) !== false
          ) {
            if (mountedRef.current) {
              scheduleSave(runSave, delayMsRef.current);
            } else {
              pendingFlushRef.current = true;
            }
          }
        },
        (err: unknown) => {
          if (seq < latestAppliedSeqRef.current) return;
          latestAppliedSeqRef.current = seq;
          setError(err);
          setStatus("error");
        },
      );

      inFlightRef.current = promise;
      try {
        await promise;
      } finally {
        if (inFlightRef.current === promise) inFlightRef.current = null;
      }
    },
    [scheduleSave],
  );

  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      lastSavedKeyRef.current = keyRef.current;
      pendingFlushRef.current = false;
      setStatus("idle");
      setError(null);
    }
    wasEnabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (enabled && isValidRef.current?.(valueRef.current) !== false) {
      const isSaved = key === lastSavedKeyRef.current;
      const nextStatus = isSaved ? "idle" : "dirty";
      setStatus((prev) => (prev === "saving" ? prev : nextStatus));
      if (isSaved) {
        pendingFlushRef.current = false;
      } else {
        scheduleSave(runSave, delayMs);
      }
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [key, enabled, delayMs, runSave, scheduleSave]);

  // Call after the adopting `setState`; `keyRef` is assigned during render.
  // Supersedes any in-flight save, whose late resolve would otherwise restore
  // the pre-adoption baseline and leave the adopted value unsaved with no timer.
  const rebase = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingFlushRef.current = false;
    latestAppliedSeqRef.current = ++seqRef.current;
    lastSavedKeyRef.current = keyRef.current;
    setStatus("idle");
    setError(null);
  }, []);

  const flush = useCallback(
    async (options?: { retryFailed?: boolean }): Promise<void> => {
      let shouldRetry = options?.retryFailed ?? false;
      if (shouldRetry && !enabledRef.current) return;

      while (inFlightRef.current || pendingFlushRef.current || shouldRetry) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const inFlight = inFlightRef.current;
        shouldRetry = false;
        if (inFlight) {
          await inFlight;
        } else {
          pendingFlushRef.current = false;
          await runSave();
        }
      }
    },
    [runSave],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (flushOnUnmount) void flush();
    };
  }, [flushOnUnmount, flush]);

  return {
    status,
    isDirty: status === "dirty",
    isSaving: status === "saving",
    hasError: status === "error",
    error,
    flush,
    savedKey: lastSavedKeyRef.current,
    rebase,
  };
}
