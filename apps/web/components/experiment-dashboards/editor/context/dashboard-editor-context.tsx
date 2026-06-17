"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DashboardTool = "cursor" | "chart" | "text" | "table" | "filter";

interface DashboardEditorContextValue {
  selectedWidgetId: string | null;
  selectWidget: (id: string | null) => void;
  tool: DashboardTool;
  setTool: (tool: DashboardTool) => void;
  /**
   * Editor-owned open state for the dataset popover so the inline viz-create
   * flow can request an auto-open before the strip mounts on the next render.
   */
  datasetOpen: boolean;
  setDatasetOpen: (open: boolean) => void;
}

const DashboardEditorContext = createContext<DashboardEditorContextValue | null>(null);

export function DashboardEditorProvider({ children }: { children: ReactNode }) {
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [tool, setTool] = useState<DashboardTool>("cursor");
  const [datasetOpen, setDatasetOpen] = useState(false);

  const selectWidget = useCallback((id: string | null) => {
    setSelectedWidgetId(id);
  }, []);

  const value = useMemo<DashboardEditorContextValue>(
    () => ({
      selectedWidgetId,
      selectWidget,
      tool,
      setTool,
      datasetOpen,
      setDatasetOpen,
    }),
    [selectedWidgetId, selectWidget, tool, datasetOpen],
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
