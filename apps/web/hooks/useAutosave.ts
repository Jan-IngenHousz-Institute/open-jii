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
  flush: () => Promise<void>;
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

  const runSave = useCallback(async () => {
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
        setStatus(keyRef.current === k ? "idle" : "dirty");
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
  }, []);

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
    if (!enabled) return;
    if (isValidRef.current && !isValidRef.current(valueRef.current)) return;
    if (key === lastSavedKeyRef.current) {
      pendingFlushRef.current = false;
      setStatus((prev) => (prev === "saving" ? prev : "idle"));
      return;
    }
    setStatus((prev) => (prev === "saving" ? prev : "dirty"));
    pendingFlushRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, delayMs);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [key, enabled, delayMs, runSave]);

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current || pendingFlushRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await runSave();
    } else if (inFlightRef.current) {
      await inFlightRef.current;
    }
  }, [runSave]);

  useEffect(() => {
    if (!flushOnUnmount) return;
    return () => {
      if (pendingFlushRef.current) {
        pendingFlushRef.current = false;
        void runSave();
      }
    };
  }, [flushOnUnmount, runSave]);

  return {
    status,
    isDirty: status === "dirty",
    isSaving: status === "saving",
    hasError: status === "error",
    error,
    flush,
  };
}
