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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { DatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";

import { DatasetAuthorRow } from "./dataset-author-row";
import type { PublishDatasetForm } from "./dataset-publish-schema";

/** The order here is the order the dataset is cited in, so it is set by hand, never by role. */
export function DatasetAuthorList({ form }: { form: UseFormReturn<PublishDatasetForm> }) {
  const { fields, move, remove } = useFieldArray({ control: form.control, name: "authors" });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over === null || active.id === over.id) {
      return;
    }
    const from = fields.findIndex((field) => field.id === active.id);
    const to = fields.findIndex((field) => field.id === over.id);
    move(from, to);
  };

  const renderRow = (field: DatasetAuthor & { id: string }, position: number) => (
    <DatasetAuthorRow
      key={field.id}
      id={field.id}
      position={position}
      author={field}
      onRemove={remove}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={fields} strategy={verticalListSortingStrategy}>
        <ul className="divide-border divide-y">{fields.map(renderRow)}</ul>
      </SortableContext>
    </DndContext>
  );
}
