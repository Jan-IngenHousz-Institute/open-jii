"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LucideIcon } from "lucide-react";
import {
  Asterisk,
  Code,
  FileText,
  GitBranch,
  GripVertical,
  HelpCircle,
  List,
  Microscope,
  PanelRightClose,
} from "lucide-react";
import { useCallback } from "react";
import { stripHtml } from "~/util/strip-html";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

/** Accent color per cell type, matching the cell components. */
const cellColors: Record<string, string> = {
  question: "#C58AAE",
  protocol: "#2D3142",
  command: "#119DA4",
  macro: "#6C5CE7",
  branch: "#F29D38",
  markdown: "#6F8596",
  output: "#94A3B8",
};

/** Active/selected background per cell type (light tint of accent). */
const cellActiveBg: Record<string, string> = {
  question: "#F9F3F6",
  protocol: "#EAEBEE",
  command: "#E7F6F6",
  macro: "#F1EFFD",
  branch: "#FBF3EA",
  markdown: "#F1F3F5",
};

const cellTypeLabels: Record<string, string> = {
  question: "Question",
  protocol: "Protocol",
  command: "Command",
  macro: "Macro",
  branch: "Branch",
  markdown: "Markdown",
  output: "Output",
};

/** Type icon per cell type, matching the icons on the cell components. */
const cellIcons: Partial<Record<string, LucideIcon>> = {
  question: HelpCircle,
  protocol: Microscope,
  macro: Code,
  branch: GitBranch,
  markdown: FileText,
};

/** Extract a short subtitle for the sidebar row. */
function getCellSubtitle(cell: WorkbookCell): string {
  switch (cell.type) {
    case "question":
      return cell.question.text || "No question yet";
    case "protocol":
      return cell.payload.name ?? "JSON";
    case "command":
      return cell.payload.name ?? (cell.payload.content || cell.payload.format);
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
  /** Reorder by moving the cell group `activeId` to the slot of `overId`. */
  onReorder?: (activeId: string, overId: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

interface SidebarRowProps {
  cell: WorkbookCell;
  number: number;
  isActive: boolean;
  draggable: boolean;
  onClick?: () => void;
  requiredLabel: string;
}

function SidebarRow({
  cell,
  number,
  isActive,
  draggable,
  onClick,
  requiredLabel,
}: SidebarRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cell.id,
    disabled: !draggable,
  });

  const color = cellColors[cell.type] ?? "#94A3B8";
  const isRequiredQuestion = cell.type === "question" && cell.question.required === true;
  const Icon = cellIcons[cell.type];
  // Show the question's label (its data column name) rather than repeating the
  // type; the icon + color already signal that it's a question.
  const primaryText =
    cell.type === "question" ? cell.name : (cellTypeLabels[cell.type] ?? cell.type);

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={cn(
        "flex h-[55px] w-full items-center justify-between rounded-[7px] text-left transition-colors",
        isDragging && "opacity-40",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
      style={{
        padding: "8px 9px 8px 9px",
        borderLeft: `3px solid ${isActive ? color : "transparent"}`,
        backgroundColor: isActive ? cellActiveBg[cell.type] : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={onClick}
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
          <span className="flex items-center gap-1">
            {Icon && <Icon className="size-3.5 shrink-0" style={{ color }} aria-hidden="true" />}
            <span
              className={cn(
                "truncate text-[13px] leading-[18px] tracking-[0.02em]",
                isActive ? "font-semibold" : "font-medium",
              )}
              style={{ color: isActive ? color : "#011111" }}
            >
              {primaryText}
            </span>
            {isRequiredQuestion && (
              <Asterisk
                className="size-3 shrink-0"
                style={{ color: "#005E5E" }}
                aria-label={requiredLabel}
              />
            )}
          </span>
          <span
            className="truncate text-[13px] font-normal leading-[21px]"
            style={{ color: "#68737B" }}
          >
            {getCellSubtitle(cell)}
          </span>
        </div>
      </div>

      {/* Drag handle (visual indicator only; the whole card drags) */}
      {draggable && (
        <div className="shrink-0">
          <GripVertical className="h-4 w-4" style={{ color: "#005E5E" }} />
        </div>
      )}
    </button>
  );
}

export function WorkbookSidebar({
  cells,
  activeCellId,
  onCellClick,
  onReorder,
  collapsed,
  onToggleCollapsed,
}: WorkbookSidebarProps) {
  const { t } = useTranslation("workbook");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Filter to only executable cells (skip output).
  const visibleCells = cells.filter((cell) => cell.type !== "output");
  const visibleIds = visibleCells.map((cell) => cell.id);

  const requiredCount = visibleCells.filter(
    (cell) => cell.type === "question" && cell.question.required,
  ).length;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onReorder) return;
      onReorder(String(active.id), String(over.id));
    },
    [onReorder],
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="group/collapse flex flex-col items-center gap-2 rounded-lg px-2 py-3 transition-colors"
        style={{ marginTop: 20 }}
        title="Expand sidebar"
      >
        <List className="h-4 w-4 text-[#005E5E] transition-colors group-hover/collapse:text-[#007575]" />
        <span className="text-[11px] font-medium leading-none text-[#005E5E] transition-colors group-hover/collapse:text-[#007575]">
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
          {requiredCount > 0 ? ` · ${requiredCount} required` : ""}
        </span>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded p-1 text-[#005E5E] transition-colors hover:text-[#007575]"
            title="Collapse sidebar"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Cell list */}
      <div
        className="mt-4 flex flex-col gap-2 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 200px)" }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
            {visibleCells.map((cell, index) => (
              <SidebarRow
                key={cell.id}
                cell={cell}
                number={index + 1}
                isActive={cell.id === activeCellId}
                draggable={onReorder !== undefined}
                onClick={() => onCellClick?.(cell.id)}
                requiredLabel={t("workbooks.required")}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
