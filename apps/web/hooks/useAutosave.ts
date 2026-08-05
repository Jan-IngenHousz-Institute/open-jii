"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "error";

export class AutosaveValidationError extends Error {
  constructor() {
    super("The current value is invalid and cannot be saved");
    this.name = "AutosaveValidationError";
  }
}

interface UseAutosaveOptions<T> {
  value: T;
  toKey: (v: T) => string;
  save: (v: T) => Promise<void>;
  /** Runs only after the latest requested value wins the serialized save queue. */
  onSaved?: (v: T) => void | Promise<void>;
  isValid?: (v: T) => boolean;
  delayMs?: number;
  flushOnUnmount?: boolean;
  /** Flipping false -> true rebases the saved anchor to the current value. */
  enabled?: boolean;
  /**
   * Persistence scope fence. Changing it rebases the current value and makes
   * every completion that started in the prior scope inert.
   */
  scopeKey?: string;
}

export interface UseAutosaveReturn {
  status: AutosaveStatus;
  isDirty: boolean;
  isSaving: boolean;
  hasError: boolean;
  /** True when this or a previously visited persistence scope has unsaved work. */
  hasUnsavedChanges: boolean;
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
  onSaved,
  isValid,
  delayMs = 1000,
  flushOnUnmount = true,
  enabled = true,
  scopeKey = "default",
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const key = useMemo(() => toKey(value), [value, toKey]);

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<unknown>(null);
  const errorRef = useRef<unknown>(null);

  const lastSavedKeyRef = useRef(key);
  const savedKeyByScopeRef = useRef(new Map([[scopeKey, key]]));
  const latestKeyByScopeRef = useRef(new Map([[scopeKey, key]]));
  latestKeyByScopeRef.current.set(scopeKey, key);
  const wasEnabledRef = useRef(enabled);
  const scopeIdentityRef = useRef({ key: scopeKey, generation: 0 });
  if (scopeIdentityRef.current.key !== scopeKey) {
    scopeIdentityRef.current = {
      key: scopeKey,
      generation: scopeIdentityRef.current.generation + 1,
    };
    const savedKey = savedKeyByScopeRef.current.get(scopeKey);
    if (savedKey === undefined) savedKeyByScopeRef.current.set(scopeKey, key);
    lastSavedKeyRef.current = savedKey ?? key;
  }

  const valueRef = useRef(value);
  const keyRef = useRef(key);
  const saveRef = useRef(save);
  const onSavedRef = useRef(onSaved);
  const isValidRef = useRef(isValid);
  const enabledRef = useRef(enabled);
  valueRef.current = value;
  keyRef.current = key;
  saveRef.current = save;
  onSavedRef.current = onSaved;
  isValidRef.current = isValid;
  enabledRef.current = enabled;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Survives the value-effect's re-render cleanup so the unmount-flush
  // effect can fire independently of cleanup ordering.
  const pendingFlushRef = useRef(false);

  const inFlightRef = useRef<Promise<void> | null>(null);

  const runSave = useCallback(async () => {
    if (inFlightRef.current) {
      // The active request owns the queue. Mark that it must inspect the newest
      // snapshot before settling, then join it instead of starting a race.
      pendingFlushRef.current = true;
      const active = inFlightRef.current;
      await active;
      return;
    }

    const promise = (async () => {
      while (enabledRef.current) {
        const v = valueRef.current;
        const k = keyRef.current;
        const scopeGeneration = scopeIdentityRef.current.generation;
        const activeScopeKey = scopeIdentityRef.current.key;

        if (isValidRef.current && !isValidRef.current(v)) {
          const validationError = new AutosaveValidationError();
          pendingFlushRef.current = true;
          errorRef.current = validationError;
          setError(validationError);
          setStatus("error");
          return;
        }
        if (k === lastSavedKeyRef.current) {
          pendingFlushRef.current = false;
          setStatus("idle");
          return;
        }

        pendingFlushRef.current = false;
        setStatus("saving");
        errorRef.current = null;
        setError(null);

        try {
          await saveRef.current(v);

          if (scopeIdentityRef.current.generation !== scopeGeneration) continue;

          if (keyRef.current !== k) {
            // The write reached the server, but only the latest snapshot may
            // run its success side effect. Continue directly with that value.
            lastSavedKeyRef.current = k;
            savedKeyByScopeRef.current.set(activeScopeKey, k);
            continue;
          }

          await onSavedRef.current?.(v);

          if (scopeIdentityRef.current.generation !== scopeGeneration) continue;

          if (keyRef.current !== k) {
            // An edit can arrive while the success side effect is awaited. It
            // must remain queued instead of being cleared as though k won.
            lastSavedKeyRef.current = k;
            savedKeyByScopeRef.current.set(activeScopeKey, k);
            continue;
          }

          lastSavedKeyRef.current = k;
          savedKeyByScopeRef.current.set(activeScopeKey, k);
        } catch (err: unknown) {
          if (scopeIdentityRef.current.generation !== scopeGeneration) continue;
          // If this snapshot was superseded, continue with the newest value.
          // Otherwise surface the error and leave it retryable.
          if (keyRef.current !== k) continue;
          pendingFlushRef.current = true;
          errorRef.current = err;
          setError(err);
          setStatus("error");
          return;
        }
        pendingFlushRef.current = false;
        errorRef.current = null;
        setStatus("idle");
        return;
      }
    })();

    inFlightRef.current = promise;
    try {
      await promise;
    } finally {
      if (inFlightRef.current === promise) inFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    const savedKey = savedKeyByScopeRef.current.get(scopeKey) ?? keyRef.current;
    lastSavedKeyRef.current = savedKey;
    pendingFlushRef.current = keyRef.current !== savedKey;
    errorRef.current = null;
    setStatus(pendingFlushRef.current ? "dirty" : "idle");
    setError(null);
  }, [scopeKey]);

  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      lastSavedKeyRef.current = keyRef.current;
      pendingFlushRef.current = false;
      errorRef.current = null;
      setStatus("idle");
      setError(null);
    }
    wasEnabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (isValidRef.current && !isValidRef.current(valueRef.current)) {
      const validationError = new AutosaveValidationError();
      pendingFlushRef.current = true;
      errorRef.current = validationError;
      setError(validationError);
      setStatus("error");
      return;
    }
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
  }, [key, enabled, delayMs, runSave, scopeKey]);

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current || pendingFlushRef.current || inFlightRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await runSave();
    }
    if (pendingFlushRef.current && errorRef.current) throw errorRef.current;
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
    hasUnsavedChanges: [...latestKeyByScopeRef.current].some(
      ([savedScope, latestKey]) => savedKeyByScopeRef.current.get(savedScope) !== latestKey,
    ),
    error,
    flush,
  };
}
