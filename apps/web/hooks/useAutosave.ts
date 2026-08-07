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
  /** The first false -> true activation establishes the current value as persisted. */
  enabled?: boolean;
  /**
   * Persistence scope fence. Changing it rebases the current value and makes
   * every completion that started in the prior scope inert.
   */
  scopeKey?: string;
  /** Persisted anchor for a scope whose editable value may be a retained local draft. */
  initialSavedKey?: string;
  /**
   * When true, an absent `initialSavedKey` means the scope has not loaded yet.
   * Autosave cannot become dirty or write until that persisted baseline arrives.
   */
  requiresInitialSavedKey?: boolean;
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
  initialSavedKey,
  requiresInitialSavedKey = false,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const key = useMemo(() => toKey(value), [value, toKey]);

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<unknown>(null);
  const errorRef = useRef<unknown>(null);

  const firstSavedKey = initialSavedKey ?? (requiresInitialSavedKey ? undefined : key);
  const lastSavedKeyRef = useRef<string | undefined>(firstSavedKey);
  const savedKeyByScopeRef = useRef(
    firstSavedKey === undefined
      ? new Map<string, string>()
      : new Map<string, string>([[scopeKey, firstSavedKey]]),
  );
  const latestKeyByScopeRef = useRef(new Map([[scopeKey, key]]));
  const activatedScopesRef = useRef(new Set(enabled ? [scopeKey] : []));
  latestKeyByScopeRef.current.set(scopeKey, key);
  const wasEnabledRef = useRef(enabled);
  const scopeIdentityRef = useRef({ key: scopeKey, generation: 0 });
  if (scopeIdentityRef.current.key !== scopeKey) {
    scopeIdentityRef.current = {
      key: scopeKey,
      generation: scopeIdentityRef.current.generation + 1,
    };
    const savedKey = savedKeyByScopeRef.current.get(scopeKey);
    const scopeSavedKey =
      savedKey ?? initialSavedKey ?? (requiresInitialSavedKey ? undefined : key);
    if (savedKey === undefined && scopeSavedKey !== undefined) {
      savedKeyByScopeRef.current.set(scopeKey, scopeSavedKey);
    }
    lastSavedKeyRef.current = scopeSavedKey;
    if (enabled) activatedScopesRef.current.add(scopeKey);
  }
  // A server-backed owner can render before its query resolves. Install the
  // first real baseline for the scope, but never let a later refetch overwrite
  // an anchor that already owns local edits.
  if (initialSavedKey !== undefined && !savedKeyByScopeRef.current.has(scopeKey)) {
    savedKeyByScopeRef.current.set(scopeKey, initialSavedKey);
    lastSavedKeyRef.current = initialSavedKey;
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
        const savedKey = savedKeyByScopeRef.current.get(activeScopeKey);

        // `undefined` is an unloaded scope, not an empty persisted workbook.
        // With no server baseline there is nothing safe to compare or write.
        if (savedKey === undefined) {
          pendingFlushRef.current = false;
          errorRef.current = null;
          setError(null);
          setStatus("idle");
          return;
        }

        if (isValidRef.current && !isValidRef.current(v)) {
          const validationError = new AutosaveValidationError();
          pendingFlushRef.current = true;
          errorRef.current = validationError;
          setError(validationError);
          setStatus("error");
          return;
        }
        if (k === savedKey) {
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
    const savedKey = savedKeyByScopeRef.current.get(scopeKey);
    lastSavedKeyRef.current = savedKey;
    pendingFlushRef.current = savedKey !== undefined && keyRef.current !== savedKey;
    errorRef.current = null;
    setStatus(pendingFlushRef.current ? "dirty" : "idle");
    setError(null);
  }, [scopeKey, initialSavedKey]);

  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      const activeScope = scopeIdentityRef.current.key;
      if (
        !activatedScopesRef.current.has(activeScope) &&
        initialSavedKey === undefined &&
        !requiresInitialSavedKey
      ) {
        // First activation initializes a scope whose disabled value may merely
        // have been loading. Later activations must retain that scope's saved
        // anchor so a real draft cannot be rebased away as "already saved".
        activatedScopesRef.current.add(activeScope);
        lastSavedKeyRef.current = keyRef.current;
        savedKeyByScopeRef.current.set(activeScope, keyRef.current);
        pendingFlushRef.current = false;
        errorRef.current = null;
        setStatus("idle");
        setError(null);
      } else {
        activatedScopesRef.current.add(activeScope);
        const savedKey = savedKeyByScopeRef.current.get(activeScope);
        lastSavedKeyRef.current = savedKey;
        pendingFlushRef.current = savedKey !== undefined && keyRef.current !== savedKey;
        setStatus(pendingFlushRef.current ? "dirty" : "idle");
      }
    }
    wasEnabledRef.current = enabled;
  }, [enabled, initialSavedKey, requiresInitialSavedKey]);

  useEffect(() => {
    if (!enabled) return;
    const savedKey = savedKeyByScopeRef.current.get(scopeKey);
    if (savedKey === undefined) {
      pendingFlushRef.current = false;
      errorRef.current = null;
      setError(null);
      setStatus("idle");
      return;
    }
    if (isValidRef.current && !isValidRef.current(valueRef.current)) {
      const validationError = new AutosaveValidationError();
      pendingFlushRef.current = true;
      errorRef.current = validationError;
      setError(validationError);
      setStatus("error");
      return;
    }
    if (key === savedKey) {
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
  }, [key, enabled, delayMs, runSave, scopeKey, initialSavedKey]);

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current || pendingFlushRef.current || inFlightRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await runSave();
    }
    if (pendingFlushRef.current && errorRef.current) {
      if (errorRef.current instanceof Error) throw errorRef.current;
      throw new Error("Autosave failed", { cause: errorRef.current });
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
    hasUnsavedChanges: [...latestKeyByScopeRef.current].some(
      ([savedScope, latestKey]) =>
        activatedScopesRef.current.has(savedScope) &&
        savedKeyByScopeRef.current.has(savedScope) &&
        savedKeyByScopeRef.current.get(savedScope) !== latestKey,
    ),
    error,
    flush,
  };
}
