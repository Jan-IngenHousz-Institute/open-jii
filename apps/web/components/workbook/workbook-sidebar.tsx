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
  AlertCircle,
  AlertTriangle,
  Code,
  FileText,
  GitBranch,
  GripVertical,
  HelpCircle,
  List,
  Microscope,
  PanelRightClose,
  Columns3,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { stripHtml } from "~/util/strip-html";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { validateWorkbook } from "@repo/api/transforms/validate-workbook";
import type {
  WorkbookIssue,
  WorkbookValidationContext,
} from "@repo/api/transforms/validate-workbook";
import { walkWorkbookCells } from "@repo/api/transforms/workbook-cell-tree";
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
  parallel: "#087F8C",
};

/** Active/selected background per cell type (light tint of accent). */
const cellActiveBg: Record<string, string> = {
  question: "#F9F3F6",
  protocol: "#EAEBEE",
  command: "#E7F6F6",
  macro: "#F1EFFD",
  branch: "#FBF3EA",
  markdown: "#F1F3F5",
  parallel: "#E8F6F7",
};

const cellTypeLabels: Record<string, string> = {
  question: "Question",
  protocol: "Protocol",
  command: "Command",
  macro: "Macro",
  branch: "Branch",
  markdown: "Markdown",
  output: "Output",
  parallel: "Parallel",
};

/** Type icon per cell type, matching the icons on the cell components. */
const cellIcons: Partial<Record<string, LucideIcon>> = {
  question: HelpCircle,
  protocol: Microscope,
  macro: Code,
  branch: GitBranch,
  markdown: FileText,
  parallel: Columns3,
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
    case "parallel":
      return `${cell.lanes.length} lane${cell.lanes.length === 1 ? "" : "s"}`;
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
  validationContext?: WorkbookValidationContext;
}

function optimisticValidationContext(cells: WorkbookCell[]): WorkbookValidationContext {
  const protocols: WorkbookValidationContext["protocols"] = {};
  const macros: WorkbookValidationContext["macros"] = {};
  for (const { cell } of walkWorkbookCells(cells)) {
    if (cell.type === "protocol") protocols[cell.payload.protocolId] = {};
    if (cell.type === "macro") macros[cell.payload.macroId] = {};
  }
  return { protocols, macros };
}

export function workbookIssueMessage(
  t: (key: string, opts?: Record<string, unknown>) => string,
  issue: WorkbookIssue,
): string {
  switch (issue.code) {
    case "missing-protocol":
      return t("workbooks.problems.issue.missingProtocol", { ref: issue.ref ?? "" });
    case "missing-macro":
      return t("workbooks.problems.issue.missingMacro", { ref: issue.ref ?? "" });
    case "dangling-branch-source":
      return t("workbooks.problems.issue.danglingBranchSource", { ref: issue.ref ?? "" });
    case "dangling-branch-goto":
      return t("workbooks.problems.issue.danglingBranchGoto", { ref: issue.ref ?? "" });
    case "mixed-sensor-families":
      return t("workbooks.problems.issue.mixedSensorFamilies", { detail: issue.detail ?? "" });
    case "macro-without-input":
      return t("workbooks.problems.issue.macroWithoutInput");
    case "unreachable-cell":
      return t("workbooks.problems.issue.unreachableCell", {
        label: issue.cellLabel ?? issue.cellId ?? "",
      });
    case "backward-goto-loop":
      return t("workbooks.problems.issue.backwardGotoLoop", { ref: issue.ref ?? "" });
    case "branch-no-default":
      return t("workbooks.problems.issue.branchNoDefault");
    case "duplicate-branch-path-id":
      return t("workbooks.problems.issue.duplicateBranchPathId", { ref: issue.ref ?? "" });
    case "path-duplicate-conditions":
      return t("workbooks.problems.issue.duplicatePathConditions", {
        detail: issue.detail ?? "",
      });
    case "PARALLEL_LANE_EMPTY":
      return `Lane ${issue.ref ?? "reference"} is empty`;
    case "PARALLEL_NO_DEFAULT_LANE":
      return "Parallel container needs exactly one default lane";
    case "PARALLEL_MULTIPLE_DEFAULT_LANES":
      return "Parallel container default lane is ambiguous";
    case "PARALLEL_LANE_ID_DUPLICATE":
      return `Duplicate lane id ${issue.ref ?? "reference"}`;
    case "PARALLEL_CELL_ID_DUPLICATE":
      return `Duplicate cell id ${issue.cellId ?? "reference"}`;
    case "PARALLEL_NAME_DUPLICATE":
      return `Parallel container name ${issue.cellLabel ?? "reference"} is not unique`;
    case "PARALLEL_REF_CROSSES_LANE":
      return `Reference ${issue.ref ?? "reference"} crosses parallel lanes`;
    case "PARALLEL_REF_INTO_BODY":
      return `Reference ${issue.ref ?? "reference"} reaches into a parallel lane`;
    case "CONTAINER_BRANCH_ESCAPES_BODY":
      return `Branch target ${issue.ref ?? "reference"} escapes its lane`;
    case "CONTAINER_NESTING_UNSUPPORTED":
      return "Parallel containers cannot be nested";
  }
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
  validationContext,
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

  const validation = useMemo(
    () => validateWorkbook(cells, validationContext ?? optimisticValidationContext(cells)),
    [cells, validationContext],
  );

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
        style={{
          maxHeight: validation.issues.length > 0 ? "calc(100vh - 380px)" : "calc(100vh - 260px)",
        }}
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

      <section
        className="mt-5 border-t border-[#EDF2F6] pt-4"
        aria-label={t("workbooks.problems.title")}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#011111]">
            {t("workbooks.problems.title")}
          </span>
          <span className="rounded-full bg-[#EDF2F6] px-2 py-0.5 text-[11px] text-[#68737B]">
            {validation.issues.length}
          </span>
        </div>
        {validation.issues.length === 0 ? (
          <p className="text-xs text-[#68737B]">{t("workbooks.problems.none")}</p>
        ) : (
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {validation.issues.map((issue, index) => {
              const Icon = issue.level === "error" ? AlertCircle : AlertTriangle;
              return (
                <button
                  key={`${issue.code}:${issue.cellId ?? "workbook"}:${issue.ref ?? index}`}
                  type="button"
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#F6F8FA] disabled:cursor-default"
                  onClick={() => issue.cellId && onCellClick?.(issue.cellId)}
                  disabled={!issue.cellId}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      issue.level === "error" ? "text-red-600" : "text-amber-600",
                    )}
                  />
                  <span className="text-[#374151]">{workbookIssueMessage(t, issue)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
