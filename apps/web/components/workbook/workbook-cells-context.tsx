"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

/**
 * The workbook's cells, for the few parts that look across the whole workbook: branch targets
 * and unique question names. Only those re-render when another cell changes; a cell that reads
 * just its own props skips the render.
 */
const WorkbookCellsContext = createContext<WorkbookCell[]>([]);

export function WorkbookCellsProvider({
  cells,
  children,
}: {
  cells: WorkbookCell[];
  children: ReactNode;
}) {
  return <WorkbookCellsContext.Provider value={cells}>{children}</WorkbookCellsContext.Provider>;
}

export function useWorkbookCells(): WorkbookCell[] {
  return useContext(WorkbookCellsContext);
}
