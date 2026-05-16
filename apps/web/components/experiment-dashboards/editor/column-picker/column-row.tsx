"use client";

import { GripVertical, X } from "lucide-react";
import type { DragEvent } from "react";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

export interface ColumnRowProps {
  name: string;
  index: number;
  column: DataColumn | undefined;
  isLast: boolean;
  draggedIndex: number | null;
  dropInsertIndex: number | null;
  rowRef: (node: HTMLDivElement | null) => void;
  onDragStart: () => void;
  onDragOverRow: (insertAt: number) => void;
  onDropRow: (insertAt: number) => void;
  onDragEnd: () => void;
  onRemove: (name: string) => void;
}

export function ColumnRow({
  name,
  index,
  column,
  isLast,
  draggedIndex,
  dropInsertIndex,
  rowRef,
  onDragStart,
  onDragOverRow,
  onDropRow,
  onDragEnd,
  onRemove,
}: ColumnRowProps) {
  const { t } = useTranslation("common");
  const isDragging = draggedIndex === index;
  const showAbove = dropInsertIndex === index && !isDragging;
  const showBelow = isLast && dropInsertIndex === index + 1 && !isDragging;

  const computeInsertAt = (e: DragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? index : index + 1;
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    onDragStart();
    // Firefox requires dataTransfer payload to start the drag.
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", name);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDragOverRow(computeInsertAt(e));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onDropRow(computeInsertAt(e));
  };

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "bg-background flex h-8 items-center gap-1.5 rounded-md border pl-1 pr-2 text-xs",
        "transition-[border-color,opacity] duration-100",
        isDragging && "opacity-40",
        showAbove && "border-t-primary border-t-2",
        showBelow && "border-b-primary border-b-2",
      )}
    >
      <span
        className="text-muted-foreground hover:text-foreground inline-flex h-full cursor-grab items-center px-1 active:cursor-grabbing"
        aria-label={t("columnPicker.dragHandle", { name })}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      {column && (
        <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px] uppercase">
          {column.type_name}
        </span>
      )}
      <button
        type="button"
        onClick={() => onRemove(name)}
        className="text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5"
        aria-label={t("columnPicker.remove", { name })}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
