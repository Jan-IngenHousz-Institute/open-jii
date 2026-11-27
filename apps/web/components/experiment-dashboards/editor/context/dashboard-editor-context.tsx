"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export type DashboardTool = "cursor" | "chart" | "text" | "table" | "filter";

interface DashboardEditorContextValue {
  selectedWidgetId: string | null;
  selectWidget: (id: string | null) => void;
  chartDuplicatePending: boolean;
  runChartDuplicate: (duplicate: () => Promise<void>) => Promise<void>;
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
  const [chartDuplicatePending, setChartDuplicatePending] = useState(false);
  const chartDuplicateInFlight = useRef(false);

  const selectWidget = useCallback((id: string | null) => {
    setSelectedWidgetId(id);
  }, []);

  const runChartDuplicate = useCallback(async (duplicate: () => Promise<void>) => {
    if (chartDuplicateInFlight.current) return;
    chartDuplicateInFlight.current = true;
    setChartDuplicatePending(true);
    try {
      await duplicate();
    } finally {
      chartDuplicateInFlight.current = false;
      setChartDuplicatePending(false);
    }
  }, []);

  const value = useMemo<DashboardEditorContextValue>(
    () => ({
      selectedWidgetId,
      selectWidget,
      chartDuplicatePending,
      runChartDuplicate,
      tool,
      setTool,
      datasetOpen,
      setDatasetOpen,
    }),
    [selectedWidgetId, selectWidget, chartDuplicatePending, runChartDuplicate, tool, datasetOpen],
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
