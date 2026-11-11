"use client";

import type { AutosaveStatus } from "@/hooks/useAutosave";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export type AutosaveDisplayStatus = AutosaveStatus | "invalid";

interface AutosaveReport {
  status: AutosaveDisplayStatus | null;
  error: unknown;
  hasUnsavedChanges: boolean;
}

interface AutosaveStatusValue extends AutosaveReport {
  setReport: (reporter: symbol, report: AutosaveReport) => void;
  clearReport: (reporter: symbol) => void;
}

const AutosaveStatusContext = createContext<AutosaveStatusValue | null>(null);

/** Bridges autosave state from a descendant page up to a layout-level indicator. */
export function AutosaveStatusProvider({ children }: { children: ReactNode }) {
  const [report, setReportState] = useState<AutosaveReport>({
    status: null,
    error: null,
    hasUnsavedChanges: false,
  });
  const lastReporter = useRef<symbol | null>(null);

  const setReport = useCallback((reporter: symbol, next: AutosaveReport) => {
    lastReporter.current = reporter;
    setReportState(next);
  }, []);

  const clearReport = useCallback((reporter: symbol) => {
    if (lastReporter.current !== reporter) return;
    lastReporter.current = null;
    setReportState({ status: null, error: null, hasUnsavedChanges: false });
  }, []);

  const value = useMemo<AutosaveStatusValue>(
    () => ({ ...report, setReport, clearReport }),
    [report, setReport, clearReport],
  );

  return <AutosaveStatusContext.Provider value={value}>{children}</AutosaveStatusContext.Provider>;
}

export function useAutosaveStatus(): {
  status: AutosaveDisplayStatus | null;
  error: unknown;
  hasUnsavedChanges: boolean;
} | null {
  const ctx = useContext(AutosaveStatusContext);
  if (!ctx) return null;
  return { status: ctx.status, error: ctx.error, hasUnsavedChanges: ctx.hasUnsavedChanges };
}

/** No-op without a provider, so callers can use it unconditionally; null means nothing to say. */
export function useReportAutosaveStatus(report: {
  status: AutosaveDisplayStatus | null;
  error: unknown;
  /**
   * Edits on screen that are not saved, including ones a failed save or a validation
   * block holds back, which `status` alone does not show.
   */
  hasUnsavedChanges?: boolean;
}): void {
  const ctx = useContext(AutosaveStatusContext);
  const reporter = useRef(Symbol("autosave-reporter")).current;
  const setReport = ctx?.setReport;
  const clearReport = ctx?.clearReport;
  const hasUnsavedChanges = report.hasUnsavedChanges ?? false;
  useEffect(() => {
    setReport?.(reporter, {
      status: report.status,
      error: report.error,
      hasUnsavedChanges,
    });
  }, [setReport, reporter, report.status, report.error, hasUnsavedChanges]);

  useEffect(() => {
    return () => clearReport?.(reporter);
  }, [clearReport, reporter]);
}
