"use client";

import { MessageSquare, Trash2, Flag } from "lucide-react";
import React from "react";
import { formatDate } from "~/util/date";

import type {
  Annotation,
  AnnotationFlagContent,
  AnnotationType,
  AnnotationFlagType,
} from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components";

const FLAG_TYPE_COLORS: Record<AnnotationFlagType, { bg: string; text: string; border: string }> = {
  outlier: {
    bg: "bg-amber-100 dark:bg-amber-950",
    text: "text-amber-900 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-800",
  },
  needs_review: {
    bg: "bg-blue-100 dark:bg-blue-950",
    text: "text-blue-900 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-800",
  },
};

export function parseAnnotations(data: string): Annotation[] {
  try {
    return JSON.parse(data) as Annotation[];
  } catch {
    return [];
  }
}

export function groupAnnotations(annotations: Annotation[]): Record<AnnotationType, Annotation[]> {
  const annotationsPerType: Record<AnnotationType, Annotation[]> = {
    comment: [],
    flag: [],
  };

  annotations.forEach((annotation) => {
    annotationsPerType[annotation.type].push(annotation);
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
    <Badge variant="outline" className="bg-highlight-light dark:bg-highlight/30 px-1">
      <Flag size={12} className="mr-2" /> {count}
    </Badge>
  );
}

function AnnotationItem({ annotation }: { annotation: Annotation }) {
  const { t } = useTranslation();
  const content = annotation.content;

  const isFlag = (
    annotation: Annotation,
  ): annotation is Annotation & { content: AnnotationFlagContent } => {
    return annotation.type === "flag";
  };

  const FlagTypeBadge = () => {
    if (!isFlag(annotation)) return null;

    const flagType = annotation.content.flagType;

    const flagBadgeBackground = FLAG_TYPE_COLORS[flagType].bg;
    const flagBadgeText = FLAG_TYPE_COLORS[flagType].text;
    const flagBadgeBorder = FLAG_TYPE_COLORS[flagType].border;

    return (
      <Badge
        variant="outline"
        className={`text-xs ${flagBadgeBackground} ${flagBadgeText} ${flagBadgeBorder}`}
      >
        <Flag className="mr-1 h-3 w-3" />
        {t(`experimentDataAnnotations.flagTypes.${flagType}`)}
      </Badge>
    );
  };

  return (
    <div className="bg-muted/50 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {annotation.createdByName ?? "Unknown User"}
          </span>
          {isFlag(annotation) && <FlagTypeBadge />}
        </div>
        <span className="text-muted-foreground text-xs">{formatDate(annotation.createdAt)}</span>
      </div>
      <p className="text-foreground text-sm leading-relaxed">{content.text}</p>
    </div>
  );
}

interface CommentsPopoverProps {
  comments: Annotation[];
  commentCount: number;
  rowId: string;
  onAddAnnotation?: (rowIds: string[], type: AnnotationType) => void;
  onDeleteAnnotations?: (rowIds: string[], type: AnnotationType) => void;
}

function CommentsPopover({
  comments,
  commentCount,
  rowId,
  onAddAnnotation,
  onDeleteAnnotations,
}: CommentsPopoverProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-left">
          <CommentsBadge count={commentCount} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-semibold">{t(`experimentDataAnnotations.comments`)}</h3>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddAnnotation?.([rowId], "comment")}
              title={t("experimentDataAnnotations.addComment")}
              className="h-8 w-8 p-0"
            >
              <MessageSquare size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDeleteAnnotations?.([rowId], "comment")}
              title={t("experimentDataAnnotations.bulkActions.removeAllComments")}
              className="h-8 w-8 p-0"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
        <div className="max-h-96 space-y-3 overflow-y-auto pr-2 pt-4">
          {comments.map((annotation) => (
            <AnnotationItem key={annotation.id} annotation={annotation} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FlagsPopoverProps {
  flags: Annotation[];
  flagCount: number;
  rowId: string;
  onAddAnnotation?: (rowIds: string[], type: AnnotationType) => void;
  onDeleteAnnotations?: (rowIds: string[], type: AnnotationType) => void;
}

function FlagsPopover({
  flags,
  flagCount,
  rowId,
  onAddAnnotation,
  onDeleteAnnotations,
}: FlagsPopoverProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-left">
          <FlagsBadge count={flagCount} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-semibold">{t(`experimentDataAnnotations.flags`)}</h3>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddAnnotation?.([rowId], "flag")}
              title={t("experimentDataAnnotations.addFlag")}
              className="h-8 w-8 p-0"
            >
              <Flag size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDeleteAnnotations?.([rowId], "flag")}
              title={t("experimentDataAnnotations.bulkActions.removeAllFlags")}
              className="h-8 w-8 p-0"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
        <div className="max-h-96 space-y-3 overflow-y-auto pr-2 pt-4">
          {flags.map((annotation) => (
            <AnnotationItem key={annotation.id} annotation={annotation} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface EmptyAnnotationsPopoverProps {
  rowId: string;
  onAddAnnotation?: (rowIds: string[], type: AnnotationType) => void;
}

function EmptyAnnotationsPopover({ rowId, onAddAnnotation }: EmptyAnnotationsPopoverProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground text-sm">
          {t("common.add")}...
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-semibold">{t(`experimentDataAnnotations.annotations`)}</h3>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddAnnotation?.([rowId], "comment")}
              title={t("experimentDataAnnotations.addComment")}
              className="h-8 w-8 p-0"
            >
              <MessageSquare size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddAnnotation?.([rowId], "flag")}
              title={t("experimentDataAnnotations.addFlag")}
              className="h-8 w-8 p-0"
            >
              <Flag size={16} />
            </Button>
          </div>
        </div>
        <div className="py-8 text-center">
          <div className="text-muted-foreground mb-3 flex w-full items-center justify-center gap-3">
            <MessageSquare size={32} strokeWidth={1.5} />
            <Flag size={32} strokeWidth={1.5} />
          </div>
          <p className="text-foreground mb-1 text-sm font-medium">
            {t(`experimentDataAnnotations.noAnnotations`)}
          </p>
          <p className="text-muted-foreground text-xs">
            {t(`experimentDataAnnotations.noAnnotationsDescription`)}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ExperimentDataTableAnnotationsCellProps {
  data: string; // JSON string of annotations array
  rowId: string;
  onAddAnnotation?: (rowIds: string[], type: AnnotationType) => void;
  onDeleteAnnotations?: (rowIds: string[], type: AnnotationType) => void;
}

export function ExperimentDataTableAnnotationsCell({
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

      {!hasAnnotations && (
        <EmptyAnnotationsPopover rowId={rowId} onAddAnnotation={onAddAnnotation} />
      )}
    </div>
  );
}
