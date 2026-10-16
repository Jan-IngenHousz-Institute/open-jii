"use client";

import type { AutosaveStatus } from "@/hooks/useAutosave";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface AutosaveStatusValue {
  status: AutosaveStatus | null;
  error: unknown;
  hasUnsavedChanges: boolean;
  setStatus: (status: AutosaveStatus | null, error?: unknown) => void;
  setHasUnsavedChanges: (hasUnsavedChanges: boolean) => void;
}

const AutosaveStatusContext = createContext<AutosaveStatusValue | null>(null);

/** Bridges autosave state from a descendant page up to a layout-level indicator. */
export function AutosaveStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState<AutosaveStatus | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const setStatus = useCallback((next: AutosaveStatus | null, nextError?: unknown) => {
    setStatusState(next);
    if (nextError !== undefined) setError(nextError);
    else if (next !== "error") setError(null);
  }, []);

  const value = useMemo<AutosaveStatusValue>(
    () => ({ status, error, hasUnsavedChanges, setStatus, setHasUnsavedChanges }),
    [status, error, hasUnsavedChanges, setStatus],
  );

  return <AutosaveStatusContext.Provider value={value}>{children}</AutosaveStatusContext.Provider>;
}

export function useAutosaveStatus(): {
  status: AutosaveStatus | null;
  error: unknown;
  hasUnsavedChanges: boolean;
} | null {
  const ctx = useContext(AutosaveStatusContext);
  if (!ctx) return null;
  return { status: ctx.status, error: ctx.error, hasUnsavedChanges: ctx.hasUnsavedChanges };
}

/** No-op without a provider, so callers can use it unconditionally; null means nothing to say. */
export function useReportAutosaveStatus(report: {
  status: AutosaveStatus | null;
  error: unknown;
  /**
   * Edits on screen that are not saved, including ones a failed save or a validation
   * block holds back, which `status` alone does not show.
   */
  hasUnsavedChanges?: boolean;
}): void {
  const ctx = useContext(AutosaveStatusContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setStatus(report.status, report.error);
  }, [ctx, report.status, report.error]);

  const hasUnsavedChanges = report.hasUnsavedChanges ?? false;
  useEffect(() => {
    ctx?.setHasUnsavedChanges(hasUnsavedChanges);
  }, [ctx, hasUnsavedChanges]);
}
