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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkbookConnectionType } from "~/hooks/iot/useIotConnections/useIotConnections";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { AddCellButton } from "./add-cell-button";
import { CellRenderer } from "./cell-renderer";
import { useProgressiveMount } from "./use-progressive-mount";
import { WorkbookCellsProvider } from "./workbook-cells-context";
import { WorkbookHeader } from "./workbook-header";
import { WorkbookSidebar } from "./workbook-sidebar";

const noop = () => {
  // no-op
};

// dnd-kit rebuilds the context every sortable reads when these change identity, so they are
// defined once rather than per render.
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 5 } };
const KEYBOARD_SENSOR_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates };
const DRAG_MODIFIERS = [restrictToVerticalAxis];

type CellExecutionStatus = "idle" | "running" | "completed" | "error";

interface CellExecutionState {
  status: CellExecutionStatus;
  error?: string;
  executionOrder?: number[];
}

interface WorkbookEditorProps {
  cells: WorkbookCell[];
  onCellsChange: (cells: WorkbookCell[]) => void;
  title?: string;
  executionStates?: Record<string, CellExecutionState>;
  isConnected?: boolean;
  isConnecting?: boolean;
  connectedDevices?: {
    id: string;
    label: string;
    family?: SensorFamily;
    name?: string;
    stableId?: string;
    ordinal?: number;
  }[];
  sensorFamily?: SensorFamily;
  onSensorFamilyChange?: (family: SensorFamily) => void;
  connectionType?: WorkbookConnectionType;
  onConnectionTypeChange?: (type: WorkbookConnectionType) => void;
  isRunningAll?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onDisconnectDevice?: (id: string) => void;
  onRunAll?: () => void;
  onStopExecution?: () => void;
  onClearOutputs?: () => void;
  onRunCell?: (cellId: string) => void;
  promptedQuestionId?: string;
  onQuestionAnswered?: (answer: string) => void;
  readOnly?: boolean;
  entitySnapshots?: EntitySnapshots;
}

export function createDefaultCell(
  type: WorkbookCell["type"],
  _sensorFamily: SensorFamily = "multispeq",
): WorkbookCell {
  const id = crypto.randomUUID();
  const base = { id, isCollapsed: false };

  switch (type) {
    case "markdown":
      return { ...base, type: "markdown", content: "" };
    case "command":
      return { ...base, type: "command", payload: { format: "string", content: "" } };
    case "protocol":
      throw new Error("Protocol cells must be created via the protocol picker");
    case "macro":
      throw new Error("Macro cells must be created via the macro picker");
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
  producer?: WorkbookCell;
}

export function buildCellGroups(cells: WorkbookCell[]): CellGroup[] {
  const cellsById = new Map(cells.map((cell) => [cell.id, cell]));
  const groups: CellGroup[] = [];
  for (let i = 0; i < cells.length; i++) {
    const source = cells[i];
    if (source.type === "output") {
      groups.push({
        id: source.id,
        source,
        sourceIndex: i,
        producer: cellsById.get(source.producedBy),
      });
      continue;
    }
    const next = i + 1 < cells.length ? cells[i + 1] : undefined;
    if (next?.type === "output" && next.producedBy === source.id) {
      groups.push({
        id: source.id,
        source,
        sourceIndex: i,
        output: next,
        outputIndex: i + 1,
        producer: source,
      });
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

interface SortableCellGroupProps extends CellGroup {
  cellNumber?: number;
  executionStates?: Record<string, CellExecutionState>;
  sensorFamily?: SensorFamily;
  readOnly?: boolean;
  entitySnapshots?: EntitySnapshots;
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

// Memoized so an edit re-renders only the group it touched. Keep every prop either this group's
// own cells or stable across edits, or each keystroke re-renders the whole workbook again.
const SortableCellGroup = memo(function SortableCellGroup({
  id,
  source,
  sourceIndex,
  output,
  outputIndex,
  producer,
  cellNumber,
  executionStates,
  sensorFamily,
  readOnly,
  entitySnapshots,
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
  const draggable = !readOnly && source.type !== "output";
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !draggable });

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
            sensorFamily={sensorFamily}
          />
        )}
        <div className="group/row flex items-stretch gap-1">
          <div className="w-10 shrink-0">
            <div className="flex flex-col items-center gap-1 pt-2">
              {draggable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  ref={setActivatorNodeRef}
                  {...attributes}
                  {...listeners}
                  aria-label="Drag to reorder"
                  className="cursor-grab opacity-0 transition-opacity active:cursor-grabbing group-hover/row:opacity-100"
                >
                  <GripVertical className="text-primary h-4 w-4" />
                </Button>
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
              producer={producer}
              executionStatus={cellState?.status}
              executionError={cellState?.error}
              promptedQuestionId={promptedQuestionId}
              onQuestionAnswered={onQuestionAnswered}
              readOnly={readOnly}
              entitySnapshots={entitySnapshots}
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
                producer={producer}
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
});

/**
 * Resolved against `el`, not the root: `--sidebar-inset-offset` is declared on
 * `SidebarInset` and only inherits down. Authored in rem.
 */
function readPixels(el: Element, name: string): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return 0;
  if (!raw.endsWith("rem")) return parsed;

  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return parsed * (Number.isFinite(rootFontSize) ? rootFontSize : 16);
}

export function WorkbookEditor({
  cells,
  onCellsChange,
  title,
  executionStates,
  isConnected,
  isConnecting,
  connectedDevices,
  sensorFamily,
  connectionType,
  isRunningAll,
  onConnect,
  onDisconnect,
  onDisconnectDevice,
  onRunAll,
  onStopExecution,
  onSensorFamilyChange,
  onConnectionTypeChange,
  onClearOutputs,
  onRunCell,
  promptedQuestionId,
  onQuestionAnswered,
  readOnly,
  entitySnapshots,
}: WorkbookEditorProps) {
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  );

  const groups = useMemo(() => buildCellGroups(cells), [cells]);
  const { mounted: mountedGroups, mountAll } = useProgressiveMount(groups.length);
  // A cell picked in the outline before its batch has mounted is scrolled to once it has.
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  // SortableContext re-renders every sortable when `items` changes identity, so the list is only
  // rebuilt when the ids themselves change.
  const sortableKey = groups
    .filter((g) => g.source.type !== "output")
    .map((g) => g.id)
    .join(" ");
  const sortableIds = useMemo(() => (sortableKey ? sortableKey.split(" ") : []), [sortableKey]);

  // The handlers read these at call time, so they keep one identity across edits.
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const onCellsChangeRef = useRef(onCellsChange);
  onCellsChangeRef.current = onCellsChange;
  const onRunCellRef = useRef(onRunCell);
  onRunCellRef.current = onRunCell;
  const onQuestionAnsweredRef = useRef(onQuestionAnswered);
  onQuestionAnsweredRef.current = onQuestionAnswered;

  const handleAdd = useCallback(
    (type: WorkbookCell["type"], atIndex: number) => {
      const newCell = createDefaultCell(type, sensorFamily);
      const updated = [...cellsRef.current];
      updated.splice(atIndex, 0, newCell);
      onCellsChangeRef.current(updated);
    },
    [sensorFamily],
  );

  const handleAddCell = useCallback((cell: WorkbookCell, atIndex: number) => {
    const updated = [...cellsRef.current];
    updated.splice(atIndex, 0, cell);
    onCellsChangeRef.current(updated);
  }, []);

  const handleUpdate = useCallback((index: number, cell: WorkbookCell) => {
    const updated = [...cellsRef.current];
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
        const existingOutput = updated[existingOutputIndex];
        if (existingOutput.type === "output") {
          updated[existingOutputIndex] = { ...existingOutput, data: { answer: cell.answer } };
        }
      }
    }

    onCellsChangeRef.current(updated);
  }, []);

  const handleDelete = useCallback((index: number) => {
    const deletedCell = cellsRef.current[index];
    let updated = [...cellsRef.current];

    // Deleting a question's output should reset the question itself.
    if (deletedCell.type === "output") {
      const sourceIndex = updated.findIndex((c) => c.id === deletedCell.producedBy);
      if (sourceIndex !== -1 && updated[sourceIndex].type === "question") {
        updated[sourceIndex] = {
          ...updated[sourceIndex],
          answer: undefined,
          isAnswered: false,
        };
      }
    }

    updated = updated.filter(
      (c, i) => i !== index && !(c.type === "output" && c.producedBy === deletedCell.id),
    );

    onCellsChangeRef.current(updated);
  }, []);

  const handleReorder = useCallback((activeId: string, overId: string) => {
    onCellsChangeRef.current(moveCellGroup(cellsRef.current, activeId, overId));
  }, []);

  const handleRunCell = useCallback((cellId: string) => {
    onRunCellRef.current?.(cellId);
  }, []);

  const handleQuestionAnswered = useCallback((answer: string) => {
    onQuestionAnsweredRef.current?.(answer);
  }, []);

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
        cell.type === "command" ||
        cell.type === "macro" ||
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

  const handleSidebarCellClick = useCallback(
    (cellId: string) => {
      setActiveCellId(cellId);
      const el = cellRefs.current[cellId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      mountAll();
      setPendingScrollId(cellId);
    },
    [mountAll],
  );

  useEffect(() => {
    const el = pendingScrollId ? cellRefs.current[pendingScrollId] : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingScrollId(null);
    }
  }, [pendingScrollId, mountedGroups]);

  const showHeader = onConnect && onRunAll;

  const headerRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const el = headerRef.current;
      if (!el) return;
      // Matches the sticky offset in workbook-header.tsx.
      const rect = el.getBoundingClientRect();
      const stickyTop =
        48 + readPixels(el, "--banner-offset") + readPixels(el, "--sidebar-inset-offset");
      setIsSticky(rect.top <= stickyTop);
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
          connectedDevices={connectedDevices ?? []}
          sensorFamily={sensorFamily ?? "multispeq"}
          onSensorFamilyChange={onSensorFamilyChange}
          connectionType={connectionType ?? "serial"}
          onConnectionTypeChange={onConnectionTypeChange}
          isRunningAll={isRunningAll ?? false}
          onConnect={onConnect}
          isSticky={isSticky}
          onDisconnect={onDisconnect ?? noop}
          onDisconnectDevice={onDisconnectDevice}
          onRunAll={onRunAll}
          onStopExecution={onStopExecution ?? noop}
          onClearOutputs={onClearOutputs ?? noop}
          readOnly={readOnly}
        />
      )}

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-0">
          <WorkbookCellsProvider cells={cells}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={DRAG_MODIFIERS}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {groups.slice(0, mountedGroups).map((group) => (
                  <SortableCellGroup
                    key={group.id}
                    {...group}
                    cellNumber={executionCounts[group.source.id]}
                    executionStates={executionStates}
                    sensorFamily={sensorFamily}
                    readOnly={readOnly}
                    entitySnapshots={entitySnapshots}
                    onRunCell={onRunCell ? handleRunCell : undefined}
                    promptedQuestionId={promptedQuestionId}
                    onQuestionAnswered={onQuestionAnswered ? handleQuestionAnswered : undefined}
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
                    sensorFamily={sensorFamily}
                    variant="bottom"
                  />
                </div>
              </div>
            )}
          </WorkbookCellsProvider>
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
