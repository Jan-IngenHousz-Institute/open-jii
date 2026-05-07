"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "error";

interface UseAutosaveOptions<T> {
  /** Current value. Identity changes drive the dirty check. */
  value: T;
  /**
   * Stable serialization for dirty comparison. Called once per `value`
   * identity change (memoized internally), so callers don't need to worry
   * about stringifying large payloads on every render.
   */
  toKey: (v: T) => string;
  /** Persistence call. Throw to signal failure — the hook flips to "error". */
  save: (v: T) => Promise<void>;
  /** Optional gate. When it returns false the value is held but no save fires. */
  isValid?: (v: T) => boolean;
  /** Debounce window before firing the save. */
  delayMs?: number;
  /** Fire any pending save when the host unmounts. */
  flushOnUnmount?: boolean;
  /**
   * Master switch. When false, the hook records value changes silently and
   * fires nothing. Flipping false → true rebases the saved anchor to the
   * current value (matches the "begin editing" pattern in code editors).
   */
  enabled?: boolean;
}

interface UseAutosaveReturn {
  status: AutosaveStatus;
  isDirty: boolean;
  isSaving: boolean;
  hasError: boolean;
  error: unknown;
  /** Force the pending save to fire now. Resolves once it (and any in-flight save) settle. */
  flush: () => Promise<void>;
}

/**
 * Generic autosave: watches a value, debounces a save call, surfaces a
 * status enum. Replaces three near-identical implementations (viz workspace,
 * workbook page, code editors).
 *
 * Mount the hook with the value already in its persisted state — the first
 * render's `toKey(value)` becomes the "saved" anchor, so a value loaded
 * from the server doesn't immediately trigger a redundant save. Subsequent
 * identity changes that produce a different key are treated as user edits.
 */
export function useAutosave<T>({
  value,
  toKey,
  save,
  isValid,
  delayMs = 1500,
  flushOnUnmount = true,
  enabled = true,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  // Compute key once per value identity. Heavy `toKey` (JSON.stringify of a
  // large object) doesn't fire on every render.
  const key = useMemo(() => toKey(value), [value, toKey]);

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<unknown>(null);

  const lastSavedKeyRef = useRef(key);
  const wasEnabledRef = useRef(enabled);

  // Stash mutable bits so the timer callback always sees fresh values
  // without re-creating itself per render.
  const valueRef = useRef(value);
  const keyRef = useRef(key);
  const saveRef = useRef(save);
  const isValidRef = useRef(isValid);
  valueRef.current = value;
  keyRef.current = key;
  saveRef.current = save;
  isValidRef.current = isValid;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether there's a save we still owe — survives re-render cleanups
  // so the unmount-flush effect can decide independently of cleanup order.
  const pendingFlushRef = useRef(false);

  // Monotonic seq guards against an older save's late resolve clobbering
  // UI state set by a newer save.
  const seqRef = useRef(0);
  const latestAppliedSeqRef = useRef(0);

  // Tracked so flush() can await the in-flight save instead of double-firing.
  const inFlightRef = useRef<Promise<void> | null>(null);

  const runSave = useCallback(async () => {
    const v = valueRef.current;
    const k = keyRef.current;

    if (isValidRef.current && !isValidRef.current(v)) return;
    if (k === lastSavedKeyRef.current) {
      // Edits cancelled out before the timer fired — nothing to do.
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
        // If the user typed more between fire and resolve, the value
        // effect will already have set status; respect it.
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

  // Rebase the saved anchor when `enabled` flips false → true. Mirrors the
  // "startEditing(currentValue)" pattern in code editors.
  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      lastSavedKeyRef.current = keyRef.current;
      pendingFlushRef.current = false;
      setStatus("idle");
      setError(null);
    }
    wasEnabledRef.current = enabled;
  }, [enabled]);

  // React to value-key drift: mark dirty + schedule save.
  useEffect(() => {
    if (!enabled) return;
    // Invalid values don't transition the status — the user sees the bad
    // value in the editor but no save indicator flicker for something
    // that won't be sent.
    if (isValidRef.current && !isValidRef.current(valueRef.current)) return;
    if (key === lastSavedKeyRef.current) {
      // Value re-settled to the saved state (e.g. user typed and undid).
      // Drop "dirty" but don't disturb an in-flight save.
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
      // Re-render cleanup: clear the timer so the next effect run can
      // schedule a fresh one. `pendingFlushRef` deliberately survives —
      // the unmount-flush effect uses it to decide whether to fire.
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

  // Unmount flush: fires only if a save is still owed.
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
