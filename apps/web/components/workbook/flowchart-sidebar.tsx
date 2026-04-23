"use client";

import {
  Code,
  FileText,
  GitBranch,
  HelpCircle,
  Microscope,
  Monitor,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { Fragment, useMemo } from "react";

import type { WorkbookCell } from "@repo/api";
import { Button } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

interface FlowchartSidebarProps {
  cells: WorkbookCell[];
  isOpen: boolean;
  onToggle: () => void;
  onCellClick: (cellId: string) => void;
  activeCellId?: string;
}

interface FlowNode {
  id: string;
  cellId: string;
  type: WorkbookCell["type"];
  label: string;
}

const nodeStyles: Record<
  WorkbookCell["type"],
  { bg: string; border: string; text: string; icon: typeof Microscope }
> = {
  protocol: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    icon: Microscope,
  },
  macro: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: Code,
  },
  question: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-700 dark:text-violet-300",
    icon: HelpCircle,
  },
  markdown: {
    bg: "bg-slate-50 dark:bg-slate-900/40",
    border: "border-slate-200 dark:border-slate-700",
    text: "text-slate-600 dark:text-slate-400",
    icon: FileText,
  },
  branch: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-300",
    icon: GitBranch,
  },
  output: {
    bg: "bg-gray-50 dark:bg-gray-900/40",
    border: "border-gray-200 dark:border-gray-700",
    text: "text-gray-600 dark:text-gray-400",
    icon: Monitor,
  },
};

function buildFlowNodes(cells: WorkbookCell[]): FlowNode[] {
  const counters: Record<string, number> = {};
  const nodes: FlowNode[] = [];

  for (const cell of cells) {
    // Skip output cells from flow
    if (cell.type === "output") continue;

    const typeLabel = cell.type.charAt(0).toUpperCase() + cell.type.slice(1);
    counters[cell.type] = (counters[cell.type] ?? 0) + 1;
    const label = `${typeLabel} ${counters[cell.type]}`;

    nodes.push({ id: `flow-${cell.id}`, cellId: cell.id, type: cell.type, label });
  }

  return nodes;
}

export function FlowchartSidebar({
  cells,
  isOpen,
  onToggle,
  onCellClick,
  activeCellId,
}: FlowchartSidebarProps) {
  const nodes = useMemo(() => buildFlowNodes(cells), [cells]);

  if (!isOpen) {
    return (
      <div className="fixed left-0 top-1/2 z-30 -translate-y-1/2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="bg-background hover:bg-muted h-12 rounded-l-none rounded-r-lg border-l-0 px-2 shadow-lg"
        >
          <PanelLeft className="size-4" />
        </Button>
      </div>
    );
  }

  const renderNode = (node: FlowNode) => {
    const isActive = activeCellId === node.cellId;
    const style = nodeStyles[node.type];
    const Icon = style.icon;

    return (
      <button
        key={node.id}
        onClick={() => onCellClick(node.cellId)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded border px-2 py-1.5 text-left text-xs transition-all hover:brightness-95",
          style.bg,
          style.border,
          isActive && "ring-primary ring-2 ring-offset-1",
        )}
      >
        <Icon className={cn("size-3", style.text)} />
        <span className={cn("truncate font-medium", style.text)}>{node.label}</span>
      </button>
    );
  };

  const renderBranchNode = (node: FlowNode) => {
    const cell = cells.find((c) => c.id === node.cellId);
    if (cell?.type !== "branch") return renderNode(node);

    const isActive = activeCellId === node.cellId;

    return (
      <div key={node.id} className="space-y-1">
        <button
          onClick={() => onCellClick(node.cellId)}
          className={cn(
            "flex w-full items-center gap-1.5 rounded border px-2 py-1.5 text-left text-xs transition-all hover:brightness-95",
            "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40",
            isActive && "ring-primary ring-2 ring-offset-1",
          )}
        >
          <GitBranch className="size-3 text-orange-700 dark:text-orange-300" />
          <span className="truncate font-medium text-orange-700 dark:text-orange-300">
            {node.label}
          </span>
        </button>

        <div className="ml-2 space-y-1">
          {cell.paths.map((path) => (
            <div key={path.id} className="border-l-2 border-orange-300 pl-2 dark:border-orange-700">
              <span className="text-muted-foreground mb-0.5 block text-[10px] font-medium">
                {path.label}
              </span>
              {path.conditions.length > 0 ? (
                <span className="text-muted-foreground/60 text-[10px]">
                  {path.conditions.length} condition{path.conditions.length !== 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground/60 text-[10px] italic">empty</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <aside className="bg-background flex h-full w-64 min-w-64 shrink-0 flex-col border-r">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <GitBranch className="text-muted-foreground size-4" />
          <span className="text-sm font-semibold">Flow</span>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onToggle}>
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1.5">
          {nodes.map((node) => (
            <Fragment key={node.id}>
              {node.type === "branch" ? renderBranchNode(node) : renderNode(node)}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="bg-muted/30 border-t px-3 py-2">
        <p className="text-muted-foreground mb-1.5 text-[9px] font-medium uppercase tracking-wider">
          Legend
        </p>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-sm bg-blue-500" />
            <span className="text-muted-foreground">Protocol</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-sm bg-emerald-500" />
            <span className="text-muted-foreground">Macro</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-sm bg-violet-500" />
            <span className="text-muted-foreground">Question</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-sm bg-orange-500" />
            <span className="text-muted-foreground">Branch</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
