import { Flag, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import React from "react";
import { AddCommentDialog } from "~/components/experiment-data/comments/add-comment-dialog";
import { useExperimentDataCommentsDelete } from "~/hooks/experiment/useExperimentDataCommentsDelete/useExperimentDataCommentsDelete";
import { formatDate } from "~/util/date";

import type {
  DeleteExperimentDataComments,
  ExperimentDataComment,
  ExperimentDataCommentFlag,
} from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Badge, Button, HoverCard, HoverCardContent, HoverCardTrigger } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

function Flags({ flags }: { flags: ExperimentDataCommentFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <>
      {flags.map((flag) => (
        <Badge key={flag} variant="outline" className="px-1">
          <Flag size={12} className="mr-2" /> {flag}
        </Badge>
      ))}
    </>
  );
}

function CommentsBadge({ count }: { count: number }) {
  if (count == 0) return null;
  return (
    <Badge variant="outline" className="px-1">
      <MessageSquare size={12} className="mr-2" /> {count}
    </Badge>
  );
}

function RenderComment({
  experimentId,
  tableName,
  rowIds,
  comment,
}: {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  comment: ExperimentDataComment;
}) {
  const { mutateAsync: deleteComment } = useExperimentDataCommentsDelete();
  const { t } = useTranslation();

  async function onDelete() {
    const type = comment.flag ? "flag" : "comment";
    const data: DeleteExperimentDataComments = {
      rowId: rowIds[0],
      createdAt: comment.createdAt,
      createdBy: comment.createdBy,
    };
    await deleteComment({
      params: { id: experimentId, tableName },
      body: data,
    });
    toast({ description: t(`experimentDataComments.deleted.${type}`) });
  }

  return (
    <div className="mt-4">
      {comment.flag && (
        <Badge variant="outline" className="px-1">
          <Flag size={12} className="mr-2" /> {comment.flag}
        </Badge>
      )}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{comment.createdByName}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-700">{comment.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RenderCommentsAndFlags({
  experimentId,
  tableName,
  rowIds,
  commentsJSON,
}: {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  commentsJSON: string;
}) {
  const { t } = useTranslation();
  const parsedCommentsAndFlags = JSON.parse(commentsJSON) as ExperimentDataComment[];
  const comments: ExperimentDataComment[] = parsedCommentsAndFlags.filter(
    (comment) => comment.flag === undefined,
  );
  const flagComments: ExperimentDataComment[] = parsedCommentsAndFlags.filter(
    (comment) => comment.flag !== undefined,
  );
  const uniqueFlags: ExperimentDataCommentFlag[] = Array.from(
    new Set(
      flagComments
        .map((comment) => comment.flag)
        .filter((flag) => flag !== undefined)
        .flat(),
    ),
  );

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex w-full flex-wrap gap-2">
          <CommentsBadge count={comments.length} />
          <Flags flags={uniqueFlags} />
          {parsedCommentsAndFlags.length == 0 && <Link href="#">{t("common.add")}...</Link>}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="">
          <div className="">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{t(`experimentDataComments.title`)}</h3>
              <div className="flex gap-2">
                <AddCommentDialog
                  experimentId={experimentId}
                  tableName={tableName}
                  rowIds={rowIds}
                  type="comment"
                />
                <AddCommentDialog
                  experimentId={experimentId}
                  tableName={tableName}
                  rowIds={rowIds}
                  type="flag"
                />
              </div>
            </div>
          </div>
          {flagComments.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-3 text-sm font-medium text-gray-600">
                {t(`experimentDataComments.titleFlags`).toUpperCase()}
              </h4>
              {flagComments.map((comment) => {
                return (
                  <RenderComment
                    key={`${comment.createdAt}-${comment.createdBy}`}
                    experimentId={experimentId}
                    tableName={tableName}
                    rowIds={rowIds}
                    comment={comment}
                  />
                );
              })}
            </div>
          )}
          {comments.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-3 text-sm font-medium text-gray-600">
                {t(`experimentDataComments.titleComments`).toUpperCase()}
              </h4>
              {comments.map((comment) => {
                return (
                  <RenderComment
                    key={`${comment.createdAt}-${comment.createdBy}`}
                    experimentId={experimentId}
                    tableName={tableName}
                    rowIds={rowIds}
                    comment={comment}
                  />
                );
              })}
            </div>
          )}
          {parsedCommentsAndFlags.length == 0 && (
            <div className="mt-4">
              <div className="text-muted-foreground mb-4 mt-4 flex w-full items-center justify-center">
                <MessageSquare size={24} />
              </div>
              <div className="text-muted-foreground">{t(`experimentDataComments.noComments`)}</div>
              <div className="text-muted-foreground text-xs">
                {t(`experimentDataComments.noCommentsDescription`)}
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
