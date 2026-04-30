"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

// Tracks the save flow state. `isDirty` is a mirror that the autosave hook
// drives — RHF's `formState.isDirty` was tried first but its rebase semantics
// (`form.reset({ keepValues: true })`) didn't reliably clear after writes
// involving fresh nested objects (e.g. swapping `dataConfig` on chart-type
// switch). Driving it ourselves keeps the indicator honest.
interface VisualizationSaveContextValue {
  isSaving: boolean;
  isDirty: boolean;
  hasError: boolean;
  markChanged: () => void;
  markSaving: () => void;
  /** Save resolved AND no edits since it was issued — fully clean. */
  markSaved: () => void;
  /** Save resolved but more edits arrived in flight — clear isSaving, keep isDirty. */
  markSavingDone: () => void;
  markFailed: () => void;
}

function noop() {
  /* default value, overridden by provider */
}

const VisualizationSaveContext = createContext<VisualizationSaveContextValue>({
  isSaving: false,
  isDirty: false,
  hasError: false,
  markChanged: noop,
  markSaving: noop,
  markSaved: noop,
  markSavingDone: noop,
  markFailed: noop,
});

export function VisualizationSaveProvider({ children }: { children: ReactNode }) {
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
    <VisualizationSaveContext.Provider
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
    </VisualizationSaveContext.Provider>
  );
}

export function useVisualizationSaveStatus() {
  return useContext(VisualizationSaveContext);
}
