"use client";

import { FlowEditor } from "@/components/flow-editor/flow-editor";
import { useState } from "react";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

interface WorkbookCanvasDraftEditorProps {
  experimentId: string;
  initialCells: WorkbookCell[];
  cells: WorkbookCell[];
  onCellsChange: (cells: WorkbookCell[]) => void;
}

export function WorkbookCanvasDraftEditor({
  experimentId,
  initialCells,
  cells,
  onCellsChange,
}: WorkbookCanvasDraftEditorProps) {
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

  return (
    <FlowEditor
      initialFlow={initialFlow}
      workbookCells={cells}
      onWorkbookCellsChange={onCellsChange}
    />
  );
}
