"use client";

import { MessageSquare, Flag } from "lucide-react";
import React from "react";
import type { OnAnnotationHandler } from "~/components/data-table/data-table-columns";

import type {
  ExperimentAnnotation,
  ExperimentAnnotationType,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

import { CommentsPopoverContent } from "./comments-popover-content";
import { EmptyAnnotationsPopoverContent } from "./empty-annotations-popover-content";
import { FlagsPopoverContent } from "./flags-popover-content";

export function parseAnnotations(data: string): ExperimentAnnotation[] {
  try {
    return JSON.parse(data) as ExperimentAnnotation[];
  } catch {
    return [];
  }
}

export function groupAnnotations(
  annotations: ExperimentAnnotation[],
): Record<ExperimentAnnotationType, ExperimentAnnotation[]> {
  const annotationsPerType: Record<ExperimentAnnotationType, ExperimentAnnotation[]> = {
    comment: [],
    flag: [],
  };

  // if (!annotations) {
  //   return annotationsPerType;
  // }

  annotations.forEach((annotation) => {
    if (annotation.type in annotationsPerType) {
      annotationsPerType[annotation.type].push(annotation);
    }
  });

  return annotationsPerType;
}

function CommentsBadge({ count }: { count: number }) {
  return (
    <Badge variant="outline" className="px-1">
      <MessageSquare size={12} className="mr-2" /> {count}
    </Badge>
  );
}

function FlagsBadge({ count }: { count: number }) {
  return (
    <Badge variant="outline" className="bg-accent/70 px-1">
      <Flag size={12} className="mr-2" /> {count}
    </Badge>
  );
}

interface CommentsPopoverProps {
  comments: ExperimentAnnotation[];
  commentCount: number;
  rowId: string;
  onAddAnnotation?: OnAnnotationHandler;
  onDeleteAnnotations?: OnAnnotationHandler;
}

// A table page renders one of these per row, so each body, translations included, waits until its
// popover opens.
function CommentsPopover({
  comments,
  commentCount,
  rowId,
  onAddAnnotation,
  onDeleteAnnotations,
}: CommentsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className="h-auto justify-start p-0">
          <CommentsBadge count={commentCount} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <CommentsPopoverContent
          comments={comments}
          rowId={rowId}
          onAddAnnotation={onAddAnnotation}
          onDeleteAnnotations={onDeleteAnnotations}
        />
      </PopoverContent>
    </Popover>
  );
}

interface FlagsPopoverProps {
  flags: ExperimentAnnotation[];
  flagCount: number;
  rowId: string;
  onAddAnnotation?: OnAnnotationHandler;
  onDeleteAnnotations?: OnAnnotationHandler;
}

function FlagsPopover({
  flags,
  flagCount,
  rowId,
  onAddAnnotation,
  onDeleteAnnotations,
}: FlagsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className="h-auto justify-start p-0">
          <FlagsBadge count={flagCount} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <FlagsPopoverContent
          flags={flags}
          rowId={rowId}
          onAddAnnotation={onAddAnnotation}
          onDeleteAnnotations={onDeleteAnnotations}
        />
      </PopoverContent>
    </Popover>
  );
}

interface EmptyAnnotationsPopoverProps {
  rowId: string;
  onAddAnnotation?: OnAnnotationHandler;
}

/** Only rendered for a caller who may add annotations — there is nothing to read. */
function EmptyAnnotationsPopover({
  rowId,
  onAddAnnotation,
}: EmptyAnnotationsPopoverProps & {
  onAddAnnotation: OnAnnotationHandler;
}) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground font-normal"
        >
          {t("common.add")}...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <EmptyAnnotationsPopoverContent rowId={rowId} onAddAnnotation={onAddAnnotation} />
      </PopoverContent>
    </Popover>
  );
}

interface ExperimentDataTableAnnotationsCellProps {
  data: string; // JSON string of annotations array
  rowId: string;
  onAddAnnotation?: OnAnnotationHandler;
  onDeleteAnnotations?: OnAnnotationHandler;
}

export function DataTableAnnotationsCell({
  data,
  rowId,
  onAddAnnotation,
  onDeleteAnnotations,
}: ExperimentDataTableAnnotationsCellProps) {
  const annotations = parseAnnotations(data);
  const annotationsPerType = groupAnnotations(annotations);

  const comments = annotationsPerType.comment;
  const flags = annotationsPerType.flag;

  const commentCount = comments.length;
  const flagCount = flags.length;

  const hasComments = commentCount > 0;
  const hasFlags = flagCount > 0;
  const hasAnnotations = hasComments || hasFlags;

  return (
    <div className="flex w-full flex-wrap gap-2">
      {hasComments && (
        <CommentsPopover
          comments={comments}
          commentCount={commentCount}
          rowId={rowId}
          onAddAnnotation={onAddAnnotation}
          onDeleteAnnotations={onDeleteAnnotations}
        />
      )}

      {hasFlags && (
        <FlagsPopover
          flags={flags}
          flagCount={flagCount}
          rowId={rowId}
          onAddAnnotation={onAddAnnotation}
          onDeleteAnnotations={onDeleteAnnotations}
        />
      )}

      {!hasAnnotations && onAddAnnotation && (
        <EmptyAnnotationsPopover rowId={rowId} onAddAnnotation={onAddAnnotation} />
      )}
    </div>
  );
}
