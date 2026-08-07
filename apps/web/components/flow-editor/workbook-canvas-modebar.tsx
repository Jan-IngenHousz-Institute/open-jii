"use client";

import { Code, HelpCircle, Microscope, MousePointer2 } from "lucide-react";
import { forwardRef } from "react";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";

import { ToolbarShell } from "../experiment-dashboards/editor/toolbar-shell";
import { MacroPicker } from "../workbook/macro-picker";
import { ProtocolPicker } from "../workbook/protocol-picker";
import { QuestionPicker } from "../workbook/question-picker";

interface WorkbookCanvasModebarProps {
  visible: boolean;
  existingCells: WorkbookCell[];
  pendingCell: WorkbookCell | null;
  onArmCell: (cell: WorkbookCell) => void;
  onCursor: () => void;
}

const ToolButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    active?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">
>(function ToolButton({ label, active, onClick, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      {...props}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-primary/40 focus-visible:outline-hidden inline-flex size-9 items-center justify-center rounded-full focus-visible:ring-2",
        active &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
});

export function WorkbookCanvasModebar({
  visible,
  existingCells,
  pendingCell,
  onArmCell,
  onCursor,
}: WorkbookCanvasModebarProps) {
  return (
    <ToolbarShell visible={visible}>
      <ToolButton label="Select" active={!pendingCell} onClick={onCursor}>
        <MousePointer2 className="size-4" />
      </ToolButton>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <ProtocolPicker onSelect={onArmCell}>
        <ToolButton label="Place protocol" active={pendingCell?.type === "protocol"}>
          <Microscope className="size-4" />
        </ToolButton>
      </ProtocolPicker>
      <MacroPicker onSelect={onArmCell}>
        <ToolButton label="Place macro" active={pendingCell?.type === "macro"}>
          <Code className="size-4" />
        </ToolButton>
      </MacroPicker>
      <QuestionPicker existingCells={existingCells} onSelect={onArmCell}>
        <ToolButton label="Place question" active={pendingCell?.type === "question"}>
          <HelpCircle className="size-4" />
        </ToolButton>
      </QuestionPicker>
    </ToolbarShell>
  );
}
