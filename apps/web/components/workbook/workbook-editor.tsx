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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { cn } from "@repo/ui/lib/utils";

import { AddCellButton } from "./add-cell-button";
import { CellRenderer } from "./cell-renderer";
import { WorkbookHeader } from "./workbook-header";
import { WorkbookSidebar } from "./workbook-sidebar";

const noop = () => {
  // no-op
};

type CellExecutionStatus = "idle" | "running" | "completed" | "error";

interface CellExecutionState {
  status: CellExecutionStatus;
  error?: string;
  executionOrder?: number[];
}

interface DeviceInfo {
  device_name?: string;
  device_battery?: number;
  device_version?: string;
  device_id?: string;
}

interface WorkbookEditorProps {
  cells: WorkbookCell[];
  onCellsChange: (cells: WorkbookCell[]) => void;
  title?: string;
  executionStates?: Record<string, CellExecutionState>;
  isConnected?: boolean;
  isConnecting?: boolean;
  deviceInfo?: DeviceInfo | null;
  sensorFamily?: "multispeq" | "ambit" | "generic";
  onSensorFamilyChange?: (family: "multispeq" | "ambit" | "generic") => void;
  connectionType?: "bluetooth" | "serial";
  onConnectionTypeChange?: (type: "bluetooth" | "serial") => void;
  isRunningAll?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onRunAll?: () => void;
  onStopExecution?: () => void;
  onClearOutputs?: () => void;
  onRunCell?: (cellId: string) => void;
  promptedQuestionId?: string;
  onQuestionAnswered?: (answer: string) => void;
  readOnly?: boolean;
}

export function createDefaultCell(
  type: WorkbookCell["type"],
  _sensorFamily: "multispeq" | "ambit" | "generic" = "multispeq",
): WorkbookCell {
  const id = crypto.randomUUID();
  const base = { id, isCollapsed: false };

  switch (type) {
    case "markdown":
      return { ...base, type: "markdown", content: "" };
    case "protocol":
      throw new Error("Protocol cells must be created via the protocol picker");
    case "macro":
      throw new Error("Macro cells must be created via the macro picker");
    case "command":
      // Self-contained, no picker; defaults to a safe handshake command the
      // user can swap via the in-cell command selector.
      return { ...base, type: "command", payload: { command: "hello" } };
    case "question":
      throw new Error("Question cells must be created via the question picker");
    case "output":
      return { ...base, type: "output", producedBy: "" };
    case "branch":
      return {
        ...base,
        type: "branch",
        paths: [
          {
            id: crypto.randomUUID(),
            label: "Path 1",
            color: "",
            conditions: [
              { id: crypto.randomUUID(), sourceCellId: "", field: "", operator: "eq", value: "" },
            ],
          },
        ],
      };
  }
}

/**
 * A draggable unit in the editor. A question's output cell is "glued" to it: it
 * is absorbed into the same group as its source so reordering carries the
 * output along and never drops anything between the pair. Output cells without
 * a preceding owner (which should not normally occur) become their own,
 * non-draggable group so they are never lost.
 */
interface CellGroup {
  id: string;
  source: WorkbookCell;
  sourceIndex: number;
  output?: WorkbookCell;
  outputIndex?: number;
}

export function buildCellGroups(cells: WorkbookCell[]): CellGroup[] {
  const groups: CellGroup[] = [];
  for (let i = 0; i < cells.length; i++) {
    const source = cells[i];
    if (source.type === "output") {
      groups.push({ id: source.id, source, sourceIndex: i });
      continue;
    }
    const next = i + 1 < cells.length ? cells[i + 1] : undefined;
    if (next?.type === "output" && next.producedBy === source.id) {
      groups.push({ id: source.id, source, sourceIndex: i, output: next, outputIndex: i + 1 });
      i++;
    } else {
      groups.push({ id: source.id, source, sourceIndex: i });
    }
  }
  return groups;
}

/**
 * Reorder the flat cell list by moving the group identified by `activeId` to
 * the slot occupied by the group identified by `overId`, using the same
 * `arrayMove` semantics dnd-kit's sortable list expects. The glued output cell
 * travels with its source.
 */
export function moveCellGroup(
  cells: WorkbookCell[],
  activeId: string,
  overId: string,
): WorkbookCell[] {
  if (activeId === overId) return cells;
  const groups = buildCellGroups(cells);
  const from = groups.findIndex((g) => g.id === activeId);
  const to = groups.findIndex((g) => g.id === overId);
  if (from === -1 || to === -1) return cells;
  return arrayMove(groups, from, to).flatMap((g) => (g.output ? [g.source, g.output] : [g.source]));
}

/**
 * Move the cell at `fromIndex` to the raw insertion point `toIndex` in the
 * full cell list. A question's output cell is glued to it, so moving the
 * question carries its output along; the insertion index is adjusted for the
 * number of cells removed before it.
 *
 * Retained as a pure, index-based reorder primitive (covered by unit tests);
 * the interactive editor and sidebar reorder through {@link moveCellGroup}.
 */
export function reorderCellsWithGluedOutput(
  cells: WorkbookCell[],
  fromIndex: number,
  toIndex: number,
): WorkbookCell[] {
  const updated = [...cells];
  const source = updated[fromIndex];
  const next = fromIndex + 1 < updated.length ? updated[fromIndex + 1] : undefined;
  const groupLen = next?.type === "output" && next.producedBy === source.id ? 2 : 1;
  const moved = updated.splice(fromIndex, groupLen);
  const adjustedIndex = toIndex > fromIndex ? toIndex - groupLen : toIndex;
  updated.splice(adjustedIndex, 0, ...moved);
  return updated;
}

interface SortableCellGroupProps {
  group: CellGroup;
  cells: WorkbookCell[];
  cellNumber?: number;
  executionStates?: Record<string, CellExecutionState>;
  sensorFamily?: "multispeq" | "ambit" | "generic";
  readOnly?: boolean;
  onRunCell?: (cellId: string) => void;
  promptedQuestionId?: string;
  onQuestionAnswered?: (answer: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onSelect: (id: string) => void;
  onAdd: (type: WorkbookCell["type"], atIndex: number) => void;
  onAddCell: (cell: WorkbookCell, atIndex: number) => void;
  onUpdate: (index: number, cell: WorkbookCell) => void;
  onDelete: (index: number) => void;
}

function SortableCellGroup({
  group,
  cells,
  cellNumber,
  executionStates,
  sensorFamily,
  readOnly,
  onRunCell,
  promptedQuestionId,
  onQuestionAnswered,
  registerRef,
  onSelect,
  onAdd,
  onAddCell,
  onUpdate,
  onDelete,
}: SortableCellGroupProps) {
  const draggable = !readOnly && group.source.type !== "output";
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, disabled: !draggable });

  const { source, sourceIndex, output, outputIndex } = group;
  const cellState = executionStates?.[source.id];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("transition-opacity", isDragging && "z-10 opacity-40")}
    >
      <div ref={(el) => registerRef(source.id, el)} onClick={() => onSelect(source.id)}>
        {!readOnly && (
          <AddCellButton
            onAdd={(type) => onAdd(type, sourceIndex)}
            onAddCell={(cell) => onAddCell(cell, sourceIndex)}
            existingCells={cells}
            sensorFamily={sensorFamily}
          />
        )}
        <div className="group/row flex items-stretch gap-1">
          <div className="w-10 shrink-0">
            <div className="flex flex-col items-center gap-1 pt-2">
              {draggable && (
                <button
                  type="button"
                  ref={setActivatorNodeRef}
                  {...attributes}
                  {...listeners}
                  aria-label="Drag to reorder"
                  className="cursor-grab opacity-0 transition-opacity active:cursor-grabbing group-hover/row:opacity-100"
                >
                  <GripVertical className="h-4 w-4" style={{ color: "#005E5E" }} />
                </button>
              )}
              {cellNumber !== undefined && (
                <span className="text-muted-foreground font-mono text-[10px] leading-none">
                  [{executionStates?.[source.id]?.executionOrder?.at(-1) ?? cellNumber}]
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <CellRenderer
              cell={source}
              onUpdate={(updated) => onUpdate(sourceIndex, updated)}
              onDelete={() => onDelete(sourceIndex)}
              onRun={onRunCell ? () => onRunCell(source.id) : undefined}
              allCells={cells}
              executionStatus={cellState?.status}
              executionError={cellState?.error}
              promptedQuestionId={promptedQuestionId}
              onQuestionAnswered={onQuestionAnswered}
              readOnly={readOnly}
            />
          </div>
        </div>
      </div>

      {output && outputIndex !== undefined && (
        <div
          ref={(el) => registerRef(output.id, el)}
          onClick={() => onSelect(output.id)}
          className="-mt-[10px]"
        >
          <div className="group/row flex items-stretch gap-1">
            <div className="w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <CellRenderer
                cell={output}
                onUpdate={(updated) => onUpdate(outputIndex, updated)}
                onDelete={() => onDelete(outputIndex)}
                onRun={onRunCell ? () => onRunCell(output.id) : undefined}
                allCells={cells}
                executionStatus={executionStates?.[output.id]?.status}
                executionError={executionStates?.[output.id]?.error}
                promptedQuestionId={promptedQuestionId}
                onQuestionAnswered={onQuestionAnswered}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkbookEditor({
  cells,
  onCellsChange,
  title,
  executionStates,
  isConnected,
  isConnecting,
  deviceInfo,
  sensorFamily,
  connectionType,
  isRunningAll,
  onConnect,
  onDisconnect,
  onRunAll,
  onStopExecution,
  onSensorFamilyChange,
  onConnectionTypeChange,
  onClearOutputs,
  onRunCell,
  promptedQuestionId,
  onQuestionAnswered,
  readOnly,
}: WorkbookEditorProps) {
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groups = useMemo(() => buildCellGroups(cells), [cells]);
  const sortableIds = useMemo(
    () => groups.filter((g) => g.source.type !== "output").map((g) => g.id),
    [groups],
  );

  const handleAdd = useCallback(
    (type: WorkbookCell["type"], atIndex: number) => {
      const newCell = createDefaultCell(type, sensorFamily);
      const updated = [...cells];
      updated.splice(atIndex, 0, newCell);
      onCellsChange(updated);
    },
    [cells, onCellsChange, sensorFamily],
  );

  const handleAddCell = useCallback(
    (cell: WorkbookCell, atIndex: number) => {
      const updated = [...cells];
      updated.splice(atIndex, 0, cell);
      onCellsChange(updated);
    },
    [cells, onCellsChange],
  );

  const handleUpdate = useCallback(
    (index: number, cell: WorkbookCell) => {
      const updated = [...cells];
      updated[index] = cell;

      if (cell.type === "question" && cell.isAnswered && cell.answer != null) {
        const existingOutputIndex = updated.findIndex(
          (c) => c.type === "output" && c.producedBy === cell.id,
        );
        if (existingOutputIndex === -1) {
          const outputCell = {
            id: crypto.randomUUID(),
            type: "output" as const,
            producedBy: cell.id,
            data: { answer: cell.answer },
            isCollapsed: false,
          };
          updated.splice(index + 1, 0, outputCell);
        } else {
          updated[existingOutputIndex] = {
            ...updated[existingOutputIndex],
            data: { answer: cell.answer },
          } as WorkbookCell;
        }
      }

      onCellsChange(updated);
    },
    [cells, onCellsChange],
  );

  const handleDelete = useCallback(
    (index: number) => {
      const deletedCell = cells[index];
      let updated = [...cells];

      // Deleting a question's output should reset the question itself.
      if (deletedCell.type === "output") {
        const sourceIndex = updated.findIndex((c) => c.id === deletedCell.producedBy);
        if (sourceIndex !== -1 && updated[sourceIndex].type === "question") {
          updated[sourceIndex] = {
            ...updated[sourceIndex],
            answer: undefined,
            isAnswered: false,
          } as WorkbookCell;
        }
      }

      updated = updated.filter(
        (c, i) => i !== index && !(c.type === "output" && c.producedBy === deletedCell.id),
      );

      onCellsChange(updated);
    },
    [cells, onCellsChange],
  );

  const handleReorder = useCallback(
    (activeId: string, overId: string) => {
      onCellsChange(moveCellGroup(cells, activeId, overId));
    },
    [cells, onCellsChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      handleReorder(String(active.id), String(over.id));
    },
    [handleReorder],
  );

  const executionCounts = useMemo(() => {
    const counts: Record<string, number | undefined> = {};
    let counter = 1;
    for (const cell of cells) {
      if (
        cell.type === "protocol" ||
        cell.type === "macro" ||
        cell.type === "command" ||
        cell.type === "question" ||
        cell.type === "branch"
      ) {
        counts[cell.id] = counter++;
      }
    }
    return counts;
  }, [cells]);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    cellRefs.current[id] = el;
  }, []);

  const handleSidebarCellClick = useCallback((cellId: string) => {
    setActiveCellId(cellId);
    const el = cellRefs.current[cellId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const showHeader = onConnect && onRunAll;

  const headerRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const el = headerRef.current;
      if (!el) return;
      // 64px matches top-16 on the sticky header.
      const rect = el.getBoundingClientRect();
      setIsSticky(rect.top <= 64);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (cells.length === 0) {
    return (
      <div className="py-12">
        {readOnly ? (
          <p className="text-muted-foreground text-center text-sm">This workbook has no cells.</p>
        ) : (
          <AddCellButton
            onAdd={(type) => handleAdd(type, 0)}
            onAddCell={(cell) => handleAddCell(cell, 0)}
            existingCells={cells}
            sensorFamily={sensorFamily}
            variant="bottom"
            showEmptyState
          />
        )}
      </div>
    );
  }

  return (
    <div ref={headerRef} className="space-y-0">
      {showHeader && (
        <WorkbookHeader
          title={title ?? "Untitled Workbook"}
          cells={cells}
          isConnected={isConnected ?? false}
          isConnecting={isConnecting ?? false}
          deviceInfo={deviceInfo ?? null}
          sensorFamily={sensorFamily ?? "multispeq"}
          onSensorFamilyChange={onSensorFamilyChange}
          connectionType={connectionType ?? "serial"}
          onConnectionTypeChange={onConnectionTypeChange}
          isRunningAll={isRunningAll ?? false}
          onConnect={onConnect}
          isSticky={isSticky}
          onDisconnect={onDisconnect ?? noop}
          onRunAll={onRunAll}
          onStopExecution={onStopExecution ?? noop}
          onClearOutputs={onClearOutputs ?? noop}
          readOnly={readOnly}
        />
      )}

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {groups.map((group) => (
                <SortableCellGroup
                  key={group.id}
                  group={group}
                  cells={cells}
                  cellNumber={executionCounts[group.source.id]}
                  executionStates={executionStates}
                  sensorFamily={sensorFamily}
                  readOnly={readOnly}
                  onRunCell={onRunCell}
                  promptedQuestionId={promptedQuestionId}
                  onQuestionAnswered={onQuestionAnswered}
                  registerRef={registerRef}
                  onSelect={setActiveCellId}
                  onAdd={handleAdd}
                  onAddCell={handleAddCell}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>

          {!readOnly && (
            <div className="flex items-stretch gap-1 pt-6">
              <div className="w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <AddCellButton
                  onAdd={(type) => handleAdd(type, cells.length)}
                  onAddCell={(cell) => handleAddCell(cell, cells.length)}
                  existingCells={cells}
                  sensorFamily={sensorFamily}
                  variant="bottom"
                />
              </div>
            </div>
          )}
        </div>

        <div className="sticky top-[120px] hidden max-h-[calc(100vh-120px)] shrink-0 xl:block">
          <WorkbookSidebar
            cells={cells}
            activeCellId={activeCellId}
            onCellClick={handleSidebarCellClick}
            onReorder={readOnly ? undefined : handleReorder}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          />
        </div>
      </div>
    </div>
  );
}
