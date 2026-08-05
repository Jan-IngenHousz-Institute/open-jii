"use client";

import { FlowEditor } from "@/components/flow-editor/flow-editor";
import { useReportAutosaveStatus } from "@/components/shared/autosave/autosave-status-context";
import { useAutosave } from "@/hooks/useAutosave";
import { useWorkbookUpdate } from "@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate";
import { useCallback, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { zWorkbookCellArray } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { Workbook } from "@repo/api/domains/workbook/workbook.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";
import { toast } from "@repo/ui/hooks/use-toast";

const AUTO_SAVE_DELAY = 1500;

interface WorkbookCanvasDraftEditorProps {
  id: string;
  experimentId: string;
  initialCells: WorkbookCell[];
  onCellsChange?: (cells: WorkbookCell[]) => void;
  onSaved?: (workbook: Workbook) => void;
}

export function WorkbookCanvasDraftEditor({
  id,
  experimentId,
  initialCells,
  onCellsChange,
  onSaved,
}: WorkbookCanvasDraftEditorProps) {
  const { mutateAsync: updateWorkbook } = useWorkbookUpdate(id, { onSuccess: onSaved });
  const [cells, setCells] = useState(initialCells);
  const [initialFlow] = useState(() => {
    const now = new Date().toISOString();
    return {
      id: "derived-draft",
      experimentId,
      graph: cellsToFlowGraph(initialCells),
      createdAt: now,
      updatedAt: now,
    };
  });

  const save = useCallback(
    async (next: WorkbookCell[]) => {
      try {
        await updateWorkbook({ id, cells: next });
      } catch (error) {
        const message = parseApiError(error)?.message;
        if (message) toast({ description: message, variant: "destructive" });
        throw error;
      }
    },
    [id, updateWorkbook],
  );

  const autosave = useAutosave<WorkbookCell[]>({
    value: cells,
    toKey: useCallback((value: WorkbookCell[]) => JSON.stringify(value), []),
    isValid: useCallback(
      (value: WorkbookCell[]) => zWorkbookCellArray.safeParse(value).success,
      [],
    ),
    save,
    delayMs: AUTO_SAVE_DELAY,
  });
  useReportAutosaveStatus(autosave);

  const handleCellsChange = useCallback(
    (next: WorkbookCell[]) => {
      setCells(next);
      onCellsChange?.(next);
    },
    [onCellsChange],
  );

  return (
    <FlowEditor
      initialFlow={initialFlow}
      workbookCells={cells}
      onWorkbookCellsChange={handleCellsChange}
    />
  );
}
