"use client";

import { MessageSquare, Trash2, Flag } from "lucide-react";
import React from "react";
import { formatDate } from "~/util/date";

import type {
  ExperimentAnnotation,
  ExperimentAnnotationFlagContent,
  ExperimentAnnotationType,
  ExperimentAnnotationFlagType,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

const FLAG_TYPE_COLORS: Record<
  ExperimentAnnotationFlagType,
  { bg: string; text: string; border: string }
> = {
  outlier: {
    bg: "bg-status-stale",
    text: "text-status-stale-foreground",
    border: "border-status-stale-foreground/30",
  },
  needs_review: {
    bg: "bg-status-published",
    text: "text-status-published-foreground",
    border: "border-status-published-foreground/30",
  },
};

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

function AnnotationItem({
  annotation,
}: {
  annotation: ExperimentAnnotation & { preview?: boolean };
}) {
  const { t } = useTranslation();
  const content = annotation.content;
  const isPreview = annotation.preview === true;

  const isFlag = (
    annotation: ExperimentAnnotation,
  ): annotation is ExperimentAnnotation & { content: ExperimentAnnotationFlagContent } => {
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

  // Localize the user name
  const displayName =
    annotation.createdByName === "You"
      ? t("experimentDataAnnotations.you")
      : (annotation.createdByName ?? t("experimentDataAnnotations.unknownUser"));

  return (
    <div
      className={`rounded-lg border p-3 ${isPreview ? "border-status-published-foreground/30 bg-status-published/50" : "bg-muted/50"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{displayName}</span>
          {isPreview && (
            <Badge
              variant="outline"
              className="border-status-published-foreground/30 bg-status-published text-status-published-foreground text-xs"
            >
              {t("experimentDataAnnotations.preview")}
            </Badge>
          )}
          {isFlag(annotation) && <FlagTypeBadge />}
        </div>
        <span className="text-muted-foreground text-xs">{formatDate(annotation.createdAt)}</span>
      </div>
      <p className="text-foreground text-sm leading-relaxed">{content.text}</p>
      {isPreview && (
        <div className="text-status-published-foreground mt-2 text-xs italic">
          {t("experimentDataAnnotations.previewNote")}
        </div>
      )}
    </div>
  );
}

interface CommentsPopoverProps {
  comments: ExperimentAnnotation[];
  commentCount: number;
  rowId: string;
  onAddAnnotation?: (rowIds: string[], type: ExperimentAnnotationType) => void;
  onDeleteAnnotations?: (rowIds: string[], type: ExperimentAnnotationType) => void;
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
        <Button type="button" variant="ghost" className="h-auto justify-start p-0">
          <CommentsBadge count={commentCount} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
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
      </PopoverContent>
    </Popover>
  );
}

interface FlagsPopoverProps {
  flags: ExperimentAnnotation[];
  flagCount: number;
  rowId: string;
  onAddAnnotation?: (rowIds: string[], type: ExperimentAnnotationType) => void;
  onDeleteAnnotations?: (rowIds: string[], type: ExperimentAnnotationType) => void;
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
        <Button type="button" variant="ghost" className="h-auto justify-start p-0">
          <FlagsBadge count={flagCount} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-semibold">{t(`experimentDataAnnotations.flags`)}</h3>
          <div className="flex gap-1">
            {onAddAnnotation && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAddAnnotation([rowId], "flag")}
                title={t("experimentDataAnnotations.addFlag")}
                className="h-8 w-8 p-0"
              >
                <Flag size={16} />
              </Button>
            )}
            {onDeleteAnnotations && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDeleteAnnotations([rowId], "flag")}
                title={t("experimentDataAnnotations.bulkActions.removeAllFlags")}
                className="h-8 w-8 p-0"
              >
                <Trash2 size={16} />
              </Button>
            )}
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
  onAddAnnotation?: (rowIds: string[], type: ExperimentAnnotationType) => void;
}

/** Only rendered for a caller who may add annotations — there is nothing to read. */
function EmptyAnnotationsPopover({
  rowId,
  onAddAnnotation,
}: EmptyAnnotationsPopoverProps & {
  onAddAnnotation: (rowIds: string[], type: ExperimentAnnotationType) => void;
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
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-semibold">{t(`experimentDataAnnotations.annotations`)}</h3>
          <div className="flex gap-1">
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddAnnotation([rowId], "flag")}
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
  onAddAnnotation?: (rowIds: string[], type: ExperimentAnnotationType) => void;
  onDeleteAnnotations?: (rowIds: string[], type: ExperimentAnnotationType) => void;
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
