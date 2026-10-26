"use client";

import { UserAvatar } from "@/components/user-avatar";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";

import type { DatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

interface DatasetAuthorRowProps {
  /** The field array's key, stable across reorders. */
  id: string;
  position: number;
  author: DatasetAuthor;
  onRemove: (position: number) => void;
}

export function DatasetAuthorRow({ id, position, author, onRemove }: DatasetAuthorRowProps) {
  const { t } = useTranslation("datasets");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const name = `${author.givenName} ${author.familyName}`;
  const isAddedByName = author.userId === null;
  const hasNoOrcid = !isAddedByName && author.orcid === null;
  const isWaiting = author.request === "pending";
  const hasAccepted = author.request === "accepted";
  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleRemove = () => onRemove(position);

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

      <UserAvatar
        firstName={author.givenName}
        lastName={author.familyName}
        className="size-8 text-xs"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          {isAddedByName ? <Badge variant="secondary">{t("describe.addedByName")}</Badge> : null}
          {isWaiting ? (
            <Badge className="bg-status-stale text-status-stale-foreground">
              {t("describe.requestPending")}
            </Badge>
          ) : null}
          {hasAccepted ? <Badge variant="outline">{t("describe.requestAccepted")}</Badge> : null}
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
          {author.affiliation !== null ? <span>{author.affiliation}</span> : null}
          {author.orcid !== null ? (
            <a
              href={`https://orcid.org/${author.orcid}`}
              target="_blank"
              rel="noreferrer"
              aria-label={t("describe.orcidLabel", { orcid: author.orcid })}
              className="hover:text-foreground inline-flex items-center gap-1"
            >
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {t("describe.orcidMark")}
              </Badge>
              {author.orcid}
            </a>
          ) : null}
          {hasNoOrcid ? <span>{t("describe.noOrcid")}</span> : null}
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleRemove}
        className="text-muted-foreground hover:text-destructive"
        aria-label={t("describe.remove", { name })}
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}
