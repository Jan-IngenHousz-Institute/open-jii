"use client";

import type { WorkbookCell } from "@repo/api";

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
