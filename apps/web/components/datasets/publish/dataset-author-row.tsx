"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import type { DatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { DatasetPersonIdentity } from "./dataset-person-identity";
import { PersonRoleSelect } from "./person-role-select";
import type { PersonRole } from "./use-dataset-people";
import { personKey } from "./use-dataset-people";

interface DatasetAuthorRowProps {
  /** The field array's key, stable across reorders. */
  id: string;
  position: number;
  author: DatasetAuthor;
  onRoleChange: (key: string, role: PersonRole) => void;
}

export function DatasetAuthorRow({ id, position, author, onRoleChange }: DatasetAuthorRowProps) {
  const { t } = useTranslation("datasets");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const name = `${author.givenName} ${author.familyName}`;
  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleRoleChange = (role: PersonRole) => onRoleChange(personKey(author), role);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("bg-card flex items-center gap-3 py-2.5", isDragging && "opacity-40")}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label={t("describe.reorder", { name })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </Button>

      <span className="text-muted-foreground w-4 text-right text-sm tabular-nums">
        {position + 1}
      </span>

      <DatasetPersonIdentity {...author} />

      <PersonRoleSelect name={name} role="author" onChange={handleRoleChange} />
    </li>
  );
}
