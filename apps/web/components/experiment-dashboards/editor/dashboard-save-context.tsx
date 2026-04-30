"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

// Mirrors the visualization save-context shape. Kept dashboard-local so the
// two editors don't share a provider — they have independent save lifecycles
// and could both be mounted in different parts of the experiment area.
interface DashboardSaveContextValue {
  isSaving: boolean;
  isDirty: boolean;
  hasError: boolean;
  markChanged: () => void;
  markSaving: () => void;
  markSaved: () => void;
  /** Save resolved but more edits arrived in flight — clear isSaving, keep isDirty. */
  markSavingDone: () => void;
  markFailed: () => void;
}

function noop() {
  /* default value, overridden by provider */
}

const DashboardSaveContext = createContext<DashboardSaveContextValue>({
  isSaving: false,
  isDirty: false,
  hasError: false,
  markChanged: noop,
  markSaving: noop,
  markSaved: noop,
  markSavingDone: noop,
  markFailed: noop,
});

export function DashboardSaveProvider({ children }: { children: ReactNode }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hasError, setHasError] = useState(false);

  const markChanged = useCallback(() => {
    setIsDirty(true);
    setHasError(false);
  }, []);

  const markSaving = useCallback(() => {
    setIsSaving(true);
    setHasError(false);
  }, []);

  const markSaved = useCallback(() => {
    setIsSaving(false);
    setIsDirty(false);
    setHasError(false);
  }, []);

  const markSavingDone = useCallback(() => {
    setIsSaving(false);
    setHasError(false);
  }, []);

  const markFailed = useCallback(() => {
    setIsSaving(false);
    setHasError(true);
  }, []);

  return (
    <DashboardSaveContext.Provider
      value={{
        isSaving,
        isDirty,
        hasError,
        markChanged,
        markSaving,
        markSaved,
        markSavingDone,
        markFailed,
      }}
    >
      {children}
    </DashboardSaveContext.Provider>
  );
}

export function useDashboardSaveStatus() {
  return useContext(DashboardSaveContext);
}
