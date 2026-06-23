"use client";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";

import { BranchCellComponent } from "./cells/branch-cell";
import { MacroCellComponent } from "./cells/macro-cell";
import { MarkdownCellComponent } from "./cells/markdown-cell";
import { OutputCellComponent } from "./cells/output-cell";
import { ProtocolCellComponent } from "./cells/protocol-cell";
import { QuestionCellComponent } from "./cells/question-cell";

interface CellRendererProps {
  cell: WorkbookCell;
  onUpdate: (cell: WorkbookCell) => void;
  onDelete: () => void;
  onRun?: () => void;
  allCells?: WorkbookCell[];
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  promptedQuestionId?: string;
  onQuestionAnswered?: (answer: string) => void;
  readOnly?: boolean;
  // Pinned entity code/metadata. When provided, protocol/macro cells render
  // from it instead of fetching the live row.
  entitySnapshots?: EntitySnapshots;
}

export function CellRenderer({
  cell,
  onUpdate,
  onDelete,
  onRun,
  allCells,
  executionStatus,
  executionError,
  promptedQuestionId,
  onQuestionAnswered,
  readOnly,
  entitySnapshots,
}: CellRendererProps) {
  switch (cell.type) {
    case "markdown":
      return (
        <MarkdownCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          executionStatus={executionStatus}
          executionError={executionError}
          readOnly={readOnly}
        />
      );
    case "protocol":
      return (
        <ProtocolCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onRun={onRun}
          executionStatus={executionStatus}
          executionError={executionError}
          readOnly={readOnly}
          snapshot={entitySnapshots?.protocols[cell.payload.protocolId]}
        />
      );
    case "macro":
      return (
        <MacroCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onRun={onRun}
          executionStatus={executionStatus}
          executionError={executionError}
          readOnly={readOnly}
          snapshot={entitySnapshots?.macros[cell.payload.macroId]}
        />
      );
    case "question":
      return (
        <QuestionCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onRun={onRun}
          executionStatus={executionStatus}
          executionError={executionError}
          promptOpen={promptedQuestionId === cell.id}
          onQuestionAnswered={promptedQuestionId === cell.id ? onQuestionAnswered : undefined}
          allCells={allCells}
          readOnly={readOnly}
        />
      );
    case "output":
      return (
        <OutputCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          readOnly={readOnly}
          allCells={allCells}
        />
      );
    case "branch":
      return (
        <BranchCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onRun={onRun}
          allCells={allCells}
          executionStatus={executionStatus}
          executionError={executionError}
          readOnly={readOnly}
        />
      );
    default:
      return null;
  }
}
