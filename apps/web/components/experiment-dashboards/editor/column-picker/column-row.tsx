"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

export interface ColumnRowProps {
  name: string;
  column: DataColumn | undefined;
  onRemove: (name: string) => void;
}

export function ColumnRow({ name, column, onRemove }: ColumnRowProps) {
  const { t } = useTranslation("common");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRemove = () => onRemove(name);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-background flex h-8 items-center gap-1.5 rounded-md border pl-1 pr-2 text-xs",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-primary/40 focus-visible:outline-hidden inline-flex h-full cursor-grab items-center px-1 focus-visible:ring-1 active:cursor-grabbing"
        aria-label={t("columnPicker.dragHandle", { name })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      {column && (
        <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px] uppercase">
          {column.type_name}
        </span>
      )}
      <button
        type="button"
        onClick={handleRemove}
        className="text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5"
        aria-label={t("columnPicker.remove", { name })}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
