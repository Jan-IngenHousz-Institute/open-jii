"use client";

import type { AutosaveStatus } from "@/hooks/useAutosave";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface AutosaveStatusValue {
  status: AutosaveStatus | null;
  error: unknown;
  // Setter for descendants — kept on the value so `useReportAutosaveStatus`
  // can push the hook's state up to the layout-level indicator.
  setStatus: (status: AutosaveStatus | null, error?: unknown) => void;
}

/**
 * Bridges autosave state from a descendant that owns the hook (e.g. a
 * page-level editor) up to a layout-level indicator. App Router lays
 * pages as children of layouts, so the provider sits in the layout and
 * the page writes into it via `useReportAutosaveStatus`.
 *
 * Pages where the indicator is co-located with the hook don't need this —
 * they read the hook's return value directly and pass it as the
 * `<AutosaveIndicator status={...} />` prop.
 */
const AutosaveStatusContext = createContext<AutosaveStatusValue | null>(null);

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

/**
 * Read autosave status from the nearest provider. Returns `null` when no
 * provider is mounted, so consumers can render nothing instead of crashing.
 */
export function useAutosaveStatus(): { status: AutosaveStatus | null; error: unknown } | null {
  const ctx = useContext(AutosaveStatusContext);
  if (!ctx) return null;
  return { status: ctx.status, error: ctx.error };
}

/**
 * Push autosave state from the hook owner up to the provider. No-op when
 * there's no provider in the tree (so callers can use this unconditionally
 * and a page without a layout-level indicator just falls back to the
 * hook's own return value).
 */
export function useReportAutosaveStatus(report: { status: AutosaveStatus; error: unknown }): void {
  const ctx = useContext(AutosaveStatusContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setStatus(report.status, report.error);
  }, [ctx, report.status, report.error]);
}
