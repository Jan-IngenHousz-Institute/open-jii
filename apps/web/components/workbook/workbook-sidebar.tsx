"use client";

import { GripVertical, List, PanelRightClose } from "lucide-react";
import { useCallback, useState } from "react";

import type { WorkbookCell } from "@repo/api";
import { cn } from "@repo/ui/lib/utils";

/** Accent color per cell type, matching the cell components. */
const cellColors: Record<string, string> = {
  question: "#C58AAE",
  protocol: "#2D3142",
  macro: "#6C5CE7",
  branch: "#D08A3C",
  markdown: "#6F8596",
  output: "#94A3B8",
};

/** Active/selected background per cell type (light tint of accent). */
const cellActiveBg: Record<string, string> = {
  question: "#F9F3F6",
  protocol: "#EAEBEE",
  macro: "#F1EFFD",
  branch: "#FBF3EA",
  markdown: "#F1F3F5",
};

const cellTypeLabels: Record<string, string> = {
  question: "Question",
  protocol: "Protocol",
  macro: "Macro",
  branch: "Branch",
  markdown: "Markdown",
  output: "Output",
};

/** Strip HTML tags and collapse whitespace to get plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract a short subtitle for the sidebar row. */
function getCellSubtitle(cell: WorkbookCell): string {
  switch (cell.type) {
    case "question":
      return cell.question.text || "Untitled";
    case "protocol":
      return cell.payload.name ?? "JSON";
    case "macro":
      return cell.payload.name ?? capitalize(cell.payload.language);
    case "branch":
      return cell.paths.map((p) => p.label).join(", ") || "Conditions";
    case "markdown": {
      if (!cell.content) return "Empty";
      const plain = stripHtml(cell.content);
      return plain || "Empty";
    }
    case "output":
      return "Result";
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface WorkbookSidebarProps {
  cells: WorkbookCell[];
  activeCellId?: string | null;
  onCellClick?: (cellId: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function WorkbookSidebar({
  cells,
  activeCellId,
  onCellClick,
  onReorder,
  collapsed,
  onToggleCollapsed,
}: WorkbookSidebarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Filter to only executable cells (skip output)
  const visibleCells = cells
    .map((cell, index) => ({ cell, originalIndex: index }))
    .filter(({ cell }) => cell.type !== "output");

  const requiredCount = visibleCells.filter(
    ({ cell }) => cell.type === "question" && cell.question.required,
  ).length;

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIndex === null) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertAt = e.clientY < midY ? index : index + 1;

      if (insertAt === dragIndex || insertAt === dragIndex + 1) {
        setDropIndex(null);
      } else {
        setDropIndex(insertAt);
      }
    },
    [dragIndex],
  );

  const handleDrop = useCallback(() => {
    if (dragIndex === null || dropIndex === null || !onReorder) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const fromOriginal = visibleCells[dragIndex].originalIndex;
    const toOriginal =
      dropIndex < visibleCells.length ? visibleCells[dropIndex].originalIndex : cells.length;
    onReorder(fromOriginal, toOriginal > fromOriginal ? toOriginal - 1 : toOriginal);
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, visibleCells, cells.length, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex flex-col items-center gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-gray-50"
        style={{ marginTop: 20 }}
        title="Expand sidebar"
      >
        <List className="h-4 w-4" style={{ color: "#68737B" }} />
        <span className="text-[11px] font-medium leading-none" style={{ color: "#68737B" }}>
          {visibleCells.length}
        </span>
      </button>
    );
  }

  return (
    <div className="w-[300px] pt-6">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-[13px] font-normal leading-[21px]" style={{ color: "#68737B" }}>
          {visibleCells.length} block{visibleCells.length !== 1 ? "s" : ""}
          {requiredCount > 0 ? ` \u00b7 ${requiredCount} required` : ""}
        </span>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded p-1 transition-colors hover:bg-gray-100"
            title="Collapse sidebar"
          >
            <PanelRightClose className="h-4 w-4" style={{ color: "#68737B" }} />
          </button>
        )}
      </div>

      {/* Cell list */}
      <div
        className="mt-4 flex flex-col gap-2 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 200px)" }}
      >
        {visibleCells.map(({ cell, originalIndex: _originalIndex }, index) => {
          const color = cellColors[cell.type] ?? "#94A3B8";
          const isActive = cell.id === activeCellId;
          const isBeingDragged = dragIndex === index;
          const number = index + 1;

          return (
            <div key={cell.id}>
              {/* Drop indicator */}
              {dropIndex === index && dragIndex !== null && (
                <div className="mb-1 h-0.5 rounded-full bg-blue-400" />
              )}

              <button
                type="button"
                className={cn(
                  "flex h-[55px] w-full items-center justify-between rounded-[7px] text-left transition-colors",
                  isBeingDragged && "opacity-40",
                )}
                style={{
                  padding: "8px 9px 8px 9px",
                  borderLeft: `3px solid ${isActive ? color : "transparent"}`,
                  backgroundColor: isActive ? cellActiveBg[cell.type] : undefined,
                }}
                onClick={() => onCellClick?.(cell.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
              >
                {/* Left: number badge + text */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {/* Numbered circle */}
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold leading-[18px]"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                      color,
                    }}
                  >
                    {number}
                  </div>

                  {/* Type + subtitle */}
                  <div className="flex min-w-0 flex-col" style={{ gap: 2, maxWidth: 160 }}>
                    <span
                      className={cn(
                        "truncate text-[13px] leading-[18px] tracking-[0.02em]",
                        isActive ? "font-semibold" : "font-medium",
                      )}
                      style={isActive ? { color } : { color: "#011111" }}
                    >
                      {cellTypeLabels[cell.type] ?? cell.type}
                    </span>
                    <span
                      className="truncate text-[13px] font-normal leading-[21px]"
                      style={{ color: "#68737B" }}
                    >
                      {getCellSubtitle(cell)}
                    </span>
                  </div>
                </div>

                {/* Drag handle */}
                {onReorder && (
                  <div
                    className="shrink-0 cursor-grab"
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      const row = e.currentTarget.closest("button");
                      if (row) {
                        const rect = row.getBoundingClientRect();
                        e.dataTransfer.setDragImage(row, rect.width - 20, rect.height / 2);
                      }
                      e.dataTransfer.effectAllowed = "move";
                      handleDragStart(index);
                    }}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="h-4 w-4" style={{ color: "#005E5E" }} />
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {/* Drop indicator after last cell */}
        {dropIndex === visibleCells.length && dragIndex !== null && (
          <div className="h-0.5 rounded-full bg-blue-400" />
        )}
      </div>
    </div>
  );
}
