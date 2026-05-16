"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DashboardTool = "cursor" | "chart" | "text" | "table" | "filter";

interface DashboardEditorContextValue {
  selectedWidgetId: string | null;
  selectWidget: (id: string | null) => void;
  tool: DashboardTool;
  setTool: (tool: DashboardTool) => void;
}

const DashboardEditorContext = createContext<DashboardEditorContextValue | null>(null);

export function DashboardEditorProvider({ children }: { children: ReactNode }) {
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [tool, setTool] = useState<DashboardTool>("cursor");

  const selectWidget = useCallback((id: string | null) => {
    setSelectedWidgetId(id);
  }, []);

  const value = useMemo<DashboardEditorContextValue>(
    () => ({ selectedWidgetId, selectWidget, tool, setTool }),
    [selectedWidgetId, selectWidget, tool],
  );

  return (
    <DashboardEditorContext.Provider value={value}>{children}</DashboardEditorContext.Provider>
  );
}

export function useDashboardEditor(): DashboardEditorContextValue {
  const ctx = useContext(DashboardEditorContext);
  if (!ctx) {
    throw new Error("useDashboardEditor must be used inside DashboardEditorProvider");
  }
  return ctx;
}
