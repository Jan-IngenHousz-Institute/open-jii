"use client";

import type { AutosaveStatus } from "@/shared/hooks/useAutosave";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface AutosaveStatusValue {
  status: AutosaveStatus | null;
  error: unknown;
  setStatus: (status: AutosaveStatus | null, error?: unknown) => void;
}

const AutosaveStatusContext = createContext<AutosaveStatusValue | null>(null);

/** Bridges autosave state from a descendant page up to a layout-level indicator. */
export function AutosaveStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState<AutosaveStatus | null>(null);
  const [error, setError] = useState<unknown>(null);

  const setStatus = useCallback((next: AutosaveStatus | null, nextError?: unknown) => {
    setStatusState(next);
    if (nextError !== undefined) setError(nextError);
    else if (next !== "error") setError(null);
  }, []);

  const value = useMemo<AutosaveStatusValue>(
    () => ({ status, error, setStatus }),
    [status, error, setStatus],
  );

  return <AutosaveStatusContext.Provider value={value}>{children}</AutosaveStatusContext.Provider>;
}

export function useAutosaveStatus(): { status: AutosaveStatus | null; error: unknown } | null {
  const ctx = useContext(AutosaveStatusContext);
  if (!ctx) return null;
  return { status: ctx.status, error: ctx.error };
}

/** No-op when no provider is mounted, so callers can use it unconditionally. */
export function useReportAutosaveStatus(report: { status: AutosaveStatus; error: unknown }): void {
  const ctx = useContext(AutosaveStatusContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setStatus(report.status, report.error);
  }, [ctx, report.status, report.error]);
}
