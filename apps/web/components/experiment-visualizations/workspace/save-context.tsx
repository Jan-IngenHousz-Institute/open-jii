"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

interface VisualizationSaveContextValue {
  isSaving: boolean;
  isDirty: boolean;
  hasError: boolean;
  markDirty: () => void;
  markSaving: () => void;
  markSaved: () => void;
  markFailed: () => void;
}

function noop() {
  /* default value, overridden by provider */
}

const VisualizationSaveContext = createContext<VisualizationSaveContextValue>({
  isSaving: false,
  isDirty: false,
  hasError: false,
  markDirty: noop,
  markSaving: noop,
  markSaved: noop,
  markFailed: noop,
});

export function VisualizationSaveProvider({ children }: { children: ReactNode }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hasError, setHasError] = useState(false);

  const markDirty = useCallback(() => {
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

  const markFailed = useCallback(() => {
    setIsSaving(false);
    setHasError(true);
  }, []);

  return (
    <VisualizationSaveContext.Provider
      value={{ isSaving, isDirty, hasError, markDirty, markSaving, markSaved, markFailed }}
    >
      {children}
    </VisualizationSaveContext.Provider>
  );
}

export function useVisualizationSaveStatus() {
  return useContext(VisualizationSaveContext);
}
