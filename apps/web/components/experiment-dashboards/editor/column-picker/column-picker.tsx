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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMemo } from "react";

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

export function ColumnPicker({ available, value, onChange, isLoading }: ColumnPickerProps) {
  const { t } = useTranslation("common");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = selected.indexOf(String(active.id));
    const to = selected.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(selected, from, to));
  };

  const handleRemove = (name: string) => {
    onChange(selected.filter((n) => n !== name));
  };

  const handleAdd = (name: string) => {
    if (selected.includes(name)) return;
    onChange([...selected, name]);
  };

  return (
    <div className="space-y-1.5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={selected} strategy={verticalListSortingStrategy}>
          {selected.map((name) => (
            <ColumnRow key={name} name={name} column={byName.get(name)} onRemove={handleRemove} />
          ))}
        </SortableContext>
      </DndContext>

      {selected.length === 0 && (
        <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
          {t("columnPicker.emptyState")}
        </div>
      )}

      {remaining.length > 0 && <AddColumnPopover remaining={remaining} onAdd={handleAdd} />}
    </div>
  );
}
