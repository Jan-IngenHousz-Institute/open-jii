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
  const [reports, setReports] = useState(new Map<symbol, AutosaveReport>());

  const setReport = useCallback((reporter: symbol, next: AutosaveReport) => {
    setReports((previous) => {
      const updated = new Map(previous);
      updated.delete(reporter);
      updated.set(reporter, next);
      return updated;
    });
  }, []);

  const clearReport = useCallback((reporter: symbol) => {
    setReports((previous) => {
      const updated = new Map(previous);
      updated.delete(reporter);
      return updated;
    });
  }, []);

  const value = useMemo<AutosaveStatusValue>(() => {
    const latest = [...reports.values()].at(-1);
    return {
      status: latest?.status ?? null,
      error: latest?.error ?? null,
      hasUnsavedChanges: [...reports.values()].some(
        (entry) => entry.hasUnsavedChanges || entry.status === "saving",
      ),
      setReport,
      clearReport,
    };
  }, [reports, setReport, clearReport]);

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
