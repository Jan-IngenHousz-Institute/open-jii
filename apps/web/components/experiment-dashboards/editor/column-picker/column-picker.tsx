"use client";

import type { DragEvent } from "react";
import { useMemo, useRef, useState } from "react";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { AddColumnPopover } from "./add-column-popover";
import { ColumnPickerSkeleton } from "./column-picker-skeleton";
import { ColumnRow } from "./column-row";

export interface ColumnPickerProps {
  available: DataColumn[];
  value: string[] | undefined;
  onChange: (next: string[]) => void;
  isLoading?: boolean;
}

/** Drag-to-reorder column list with add/remove, backed by native HTML5 drag/drop. */
export function ColumnPicker({ available, value, onChange, isLoading }: ColumnPickerProps) {
  const { t } = useTranslation("common");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef(draggedIndex);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  draggedIndexRef.current = draggedIndex;

  const byName = useMemo(() => new Map(available.map((c) => [c.name, c])), [available]);

  const selected = useMemo(
    () => (value ?? available.map((c) => c.name)).filter((name) => byName.has(name)),
    [value, available, byName],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const remaining = available.filter((c) => !selectedSet.has(c.name));

  if (isLoading && available.length === 0) {
    return <ColumnPickerSkeleton />;
  }

  const reorderTo = (from: number, insertAt: number) => {
    if (from < 0 || insertAt < 0) return;
    if (insertAt === from || insertAt === from + 1) return;
    const next = [...selected];
    const [moved] = next.splice(from, 1);
    // Splicing removes one item before this position when moving forward.
    const adjusted = insertAt > from ? insertAt - 1 : insertAt;
    next.splice(adjusted, 0, moved);
    onChange(next);
  };

  const handleRemove = (name: string) => {
    onChange(selected.filter((n) => n !== name));
  };

  const handleAdd = (name: string) => {
    if (selected.includes(name)) return;
    onChange([...selected, name]);
  };

  const computeInsertAtFromContainer = (e: DragEvent<HTMLDivElement>): number | null => {
    const rows = rowRefs.current.filter((r): r is HTMLDivElement => r !== null);
    if (rows.length === 0) return null;
    const y = e.clientY;
    const first = rows[0].getBoundingClientRect();
    if (y < first.top + first.height / 2) return 0;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) return i;
    }
    return rows.length;
  };

  const handleContainerDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (draggedIndexRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const insertAt = computeInsertAtFromContainer(e);
    if (insertAt !== null && dropInsertIndex !== insertAt) {
      setDropInsertIndex(insertAt);
    }
  };

  const handleContainerDrop = (e: DragEvent<HTMLDivElement>) => {
    if (draggedIndexRef.current === null) return;
    const insertAt = computeInsertAtFromContainer(e);
    if (insertAt === null) return;
    e.preventDefault();
    reorderTo(draggedIndexRef.current, insertAt);
    setDraggedIndex(null);
    setDropInsertIndex(null);
  };

  const handleContainerDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Crossing into a child fires dragleave but stays inside the container.
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDropInsertIndex(null);
  };

  const setRowRef = (index: number) => (node: HTMLDivElement | null) => {
    rowRefs.current[index] = node;
  };

  const resetDragState = () => {
    setDraggedIndex(null);
    setDropInsertIndex(null);
  };

  const handleRowDrop = (insertAt: number) => {
    const from = draggedIndexRef.current;
    if (from !== null) reorderTo(from, insertAt);
    resetDragState();
  };

  return (
    <div
      className="space-y-1.5"
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
      onDragLeave={handleContainerDragLeave}
    >
      {selected.map((name, index) => (
        <ColumnRow
          key={name}
          name={name}
          index={index}
          column={byName.get(name)}
          isLast={index === selected.length - 1}
          draggedIndex={draggedIndex}
          dropInsertIndex={dropInsertIndex}
          rowRef={setRowRef(index)}
          onDragStart={() => setDraggedIndex(index)}
          onDragOverRow={setDropInsertIndex}
          onDropRow={handleRowDrop}
          onDragEnd={resetDragState}
          onRemove={handleRemove}
        />
      ))}

      {selected.length === 0 && (
        <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
          {t("columnPicker.emptyState")}
        </div>
      )}

      {remaining.length > 0 && <AddColumnPopover remaining={remaining} onAdd={handleAdd} />}
    </div>
  );
}
