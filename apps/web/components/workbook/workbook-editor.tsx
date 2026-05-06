"use client";

import { GripVertical } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // A source cell's output cell is glued to it: dragging the source moves both,
  // and drops between the pair are rejected.
  const dragRange = useCallback(
    (srcIdx: number): [number, number] => {
      const cell = cells[srcIdx];
      const next = cells[srcIdx + 1];
      if (next.type === "output" && next.producedBy === cell.id) {
        return [srcIdx, srcIdx + 2];
      }
      return [srcIdx, srcIdx + 1];
    },
    [cells],
  );

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

      const [start, end] = dragRange(dragIndex);
      const noOp = insertAt >= start && insertAt <= end;

      const before = cells[insertAt - 1];
      const after = cells[insertAt];
      const splitsOutputPair = after.type === "output" && after.producedBy === before.id;

      if (noOp || splitsOutputPair) {
        setDropIndex(null);
      } else {
        setDropIndex(insertAt);
      }
    },
    [dragIndex, cells, dragRange],
  );

  const handleDrop = useCallback(() => {
    if (dragIndex === null || dropIndex === null) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const [start, end] = dragRange(dragIndex);
    const updated = [...cells];
    const moved = updated.splice(start, end - start);
    const adjustedIndex = dropIndex > start ? dropIndex - moved.length : dropIndex;
    updated.splice(adjustedIndex, 0, ...moved);
    onCellsChange(updated);
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, cells, onCellsChange, dragRange]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  const executionCounts = useMemo(() => {
    const counts: Record<string, number | undefined> = {};
    let counter = 1;
    for (const cell of cells) {
      if (
        cell.type === "protocol" ||
        cell.type === "macro" ||
        cell.type === "question" ||
        cell.type === "branch"
      ) {
        counts[cell.id] = counter++;
      }
    }
    return counts;
  }, [cells]);

  const handleSidebarCellClick = useCallback((cellId: string) => {
    setActiveCellId(cellId);
    const el = cellRefs.current[cellId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleSidebarReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const updated = [...cells];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      onCellsChange(updated);
    },
    [cells, onCellsChange],
  );

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
        />
      )}

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-0">
          {cells.map((cell, index) => {
            const cellState = executionStates?.[cell.id];
            const isOutput = cell.type === "output";
            const cellNumber = executionCounts[cell.id];
            const isBeingDragged = dragIndex === index;
            return (
              <Fragment key={cell.id}>
                {!readOnly && (
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ease-in-out",
                      dropIndex === index && dragIndex !== null
                        ? "grid-rows-[1fr]"
                        : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1 py-1">
                        <div className="w-10 shrink-0" />
                        <div className="h-0.5 flex-1 rounded-full bg-blue-400" />
                      </div>
                    </div>
                  </div>
                )}

                <div
                  ref={(el) => {
                    cellRefs.current[cell.id] = el;
                  }}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  onClick={() => setActiveCellId(cell.id)}
                  className={cn(
                    "transition-opacity duration-200",
                    isBeingDragged && "opacity-40",
                    isOutput && "-mt-[10px]",
                  )}
                >
                  {!isOutput &&
                    (readOnly ? (
                      <div className="py-3" />
                    ) : (
                      <AddCellButton
                        onAdd={(type) => handleAdd(type, index)}
                        onAddCell={(cell) => handleAddCell(cell, index)}
                        existingCells={cells}
                        sensorFamily={sensorFamily}
                      />
                    ))}
                  <div className="group/row flex items-stretch gap-1">
                    <div className="relative w-10 shrink-0">
                      <div className="flex justify-center pt-2">
                        {cellNumber !== undefined && (
                          <span className="text-muted-foreground font-mono text-[10px] leading-none">
                            [{executionStates?.[cell.id]?.executionOrder?.at(-1) ?? cellNumber}]
                          </span>
                        )}
                      </div>
                      {!isOutput && !readOnly && (
                        <div
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab opacity-0 transition-opacity group-hover/row:opacity-100"
                          draggable
                          onDragStart={(e) => {
                            const row = e.currentTarget.parentElement?.parentElement;
                            if (row) {
                              e.dataTransfer.setDragImage(row, 20, 20);
                            }
                            e.dataTransfer.effectAllowed = "move";
                            handleDragStart(index);
                          }}
                          onDragEnd={handleDragEnd}
                        >
                          <GripVertical className="text-muted-foreground h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <CellRenderer
                        cell={cell}
                        onUpdate={(updated) => handleUpdate(index, updated)}
                        onDelete={() => handleDelete(index)}
                        onRun={onRunCell ? () => onRunCell(cell.id) : undefined}
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
              </Fragment>
            );
          })}

          {!readOnly && (
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-in-out",
                dropIndex === cells.length && dragIndex !== null
                  ? "grid-rows-[1fr]"
                  : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="flex items-center gap-1 py-1">
                  <div className="w-10 shrink-0" />
                  <div className="h-0.5 flex-1 rounded-full bg-blue-400" />
                </div>
              </div>
            </div>
          )}

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
            onReorder={readOnly ? undefined : handleSidebarReorder}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          />
        </div>
      </div>
    </div>
  );
}
