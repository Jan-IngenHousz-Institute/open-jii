"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import type { OnAnnotationHandler } from "~/components/data-table/data-table-columns";

import type { ExperimentAnnotation } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { AnnotationItem } from "./annotation-item";

interface CommentsPopoverContentProps {
  comments: ExperimentAnnotation[];
  rowId: string;
  onAddAnnotation?: OnAnnotationHandler;
  onDeleteAnnotations?: OnAnnotationHandler;
}

export function CommentsPopoverContent({
  comments,
  rowId,
  onAddAnnotation,
  onDeleteAnnotations,
}: CommentsPopoverContentProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="text-base font-semibold">{t(`experimentDataAnnotations.comments`)}</h3>
        {/* Annotating is a write: the handlers are only passed to a caller who
            may contribute, so their absence is what hides these. Reading the
            existing annotations stays available to anyone who can read. */}
        <div className="flex gap-1">
          {onAddAnnotation && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddAnnotation([rowId], "comment")}
              title={t("experimentDataAnnotations.addComment")}
              className="h-8 w-8 p-0"
            >
              <MessageSquare size={16} />
            </Button>
          )}
          {onDeleteAnnotations && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDeleteAnnotations([rowId], "comment")}
              title={t("experimentDataAnnotations.bulkActions.removeAllComments")}
              className="h-8 w-8 p-0"
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </div>
      <div className="max-h-96 space-y-3 overflow-y-auto pr-2 pt-4">
        {comments.map((annotation) => (
          <AnnotationItem key={annotation.id} annotation={annotation} />
        ))}
      </div>
    </>
  );
}
