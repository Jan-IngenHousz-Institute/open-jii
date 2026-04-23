"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

interface WorkbookSaveContextValue {
  isSaving: boolean;
  isDirty: boolean;
  markDirty: () => void;
  markSaving: () => void;
  markSaved: () => void;
}

function noop() {
  /* default context value — overridden by provider */
}

const WorkbookSaveContext = createContext<WorkbookSaveContextValue>({
  isSaving: false,
  isDirty: false,
  markDirty: noop,
  markSaving: noop,
  markSaved: noop,
});

export function WorkbookSaveProvider({ children }: { children: ReactNode }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const markSaving = useCallback(() => {
    setIsSaving(true);
  }, []);

  const markSaved = useCallback(() => {
    setIsSaving(false);
    setIsDirty(false);
  }, []);

  return (
    <WorkbookSaveContext.Provider value={{ isSaving, isDirty, markDirty, markSaving, markSaved }}>
      {children}
    </WorkbookSaveContext.Provider>
  );
}

export function useWorkbookSaveStatus() {
  return useContext(WorkbookSaveContext);
}
