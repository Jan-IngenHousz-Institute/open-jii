"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DashboardMode = "view" | "edit";

interface DashboardModeContextValue {
  mode: DashboardMode;
  setMode: (mode: DashboardMode) => void;
  toggleMode: () => void;
}

const DashboardModeContext = createContext<DashboardModeContextValue | null>(null);

interface DashboardModeProviderProps {
  initialMode?: DashboardMode;
  children: ReactNode;
}

export function DashboardModeProvider({
  initialMode = "view",
  children,
}: DashboardModeProviderProps) {
  const [mode, setMode] = useState<DashboardMode>(initialMode);
  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "edit" ? "view" : "edit"));
  }, []);
  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode, toggleMode]);
  return <DashboardModeContext.Provider value={value}>{children}</DashboardModeContext.Provider>;
}

export function useDashboardMode(): DashboardModeContextValue {
  const ctx = useContext(DashboardModeContext);
  if (!ctx) {
    throw new Error("useDashboardMode must be used inside DashboardModeProvider");
  }
  return ctx;
}
