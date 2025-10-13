import { Flag, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { AddAnnotationDialog } from "~/components/experiment-data/annotations/add-annotation-dialog";
import type { AnnotationData } from "~/hooks/experiment/useExperimentData/useExperimentData";
import { formatDate } from "~/util/date";

import type {
  Annotation,
  AnnotationCommentContent,
  AnnotationFlagContent,
  AnnotationFlagType,
} from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Badge, Button, HoverCard, HoverCardContent, HoverCardTrigger } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

function Flags({ flags }: { flags: AnnotationFlagType[] }) {
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
  if (count === 0) return null;
  return (
    <Badge variant="outline" className="px-1">
      <MessageSquare size={12} className="mr-2" /> {count}
    </Badge>
  );
}

function Annotation({
  experimentId,
  tableName,
  rowIds,
  annotation,
}: {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  annotation: Annotation;
}) {
  const { t } = useTranslation();

  function onDelete() {
    // TODO: Implement API call to delete annotation and remove logging statement
    console.log("onDelete", { experimentId, tableName, rowIds, annotation });
    toast({ description: t(`experimentDataAnnotations.deleted.${annotation.type}`) });
  }

  function getText() {
    if (annotation.type === "flag") {
      const content = annotation.content as AnnotationFlagContent;
      return content.reason;
    } else {
      const content = annotation.content as AnnotationCommentContent;
      return content.text;
    }
  }

  function getFlagType() {
    if (annotation.type === "flag") {
      const content = annotation.content as AnnotationFlagContent;
      return content.flagType;
    }
    return undefined;
  }

  return (
    <div className="mt-4">
      {annotation.type === "flag" && (
        <Badge variant="outline" className="px-1">
          <Flag size={12} className="mr-2" />{" "}
          {t(`experimentDataAnnotations.flagType.${getFlagType()}`)}
        </Badge>
      )}
      <div className="grid w-full grid-cols-[3fr_1fr_1fr] grid-rows-2 items-center">
        <div className="text-sm font-medium">{annotation.userName}</div>
        <div className="text-xs text-gray-500">{formatDate(annotation.createdAt)}</div>
        <div>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        <div className="col-span-3 text-sm text-gray-700">{getText()}</div>
      </div>
    </div>
  );
}

export interface AnnotationsProps {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  data: AnnotationData;
}

export function Annotations({ experimentId, tableName, rowIds, data }: AnnotationsProps) {
  const { t } = useTranslation();
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex w-full flex-wrap gap-2">
          <CommentsBadge count={data.commentCount} />
          <Flags flags={Array.from(data.uniqueFlags)} />
          {data.count === 0 && <Link href="#">{t("common.add")}...</Link>}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{t(`experimentDataAnnotations.title`)}</h3>
          <div className="flex gap-2">
            <AddAnnotationDialog
              experimentId={experimentId}
              tableName={tableName}
              rowIds={rowIds}
              type="comment"
            />
            <AddAnnotationDialog
              experimentId={experimentId}
              tableName={tableName}
              rowIds={rowIds}
              type="flag"
            />
          </div>
        </div>
        {data.flagCount > 0 && (
          <div className="mt-4">
            <h4 className="mb-3 text-sm font-medium uppercase text-gray-600">
              {t(`experimentDataAnnotations.titleFlags`)}
            </h4>
            {data.annotationsPerType.flag.map((annotation) => {
              return (
                <Annotation
                  key={annotation.id}
                  experimentId={experimentId}
                  tableName={tableName}
                  rowIds={rowIds}
                  annotation={annotation}
                />
              );
            })}
          </div>
        )}
        {data.commentCount > 0 && (
          <div className="mt-4">
            <h4 className="mb-3 text-sm font-medium uppercase text-gray-600">
              {t(`experimentDataAnnotations.titleComments`)}
            </h4>
            {data.annotationsPerType.comment.map((annotation) => {
              return (
                <Annotation
                  key={annotation.id}
                  experimentId={experimentId}
                  tableName={tableName}
                  rowIds={rowIds}
                  annotation={annotation}
                />
              );
            })}
          </div>
        )}
        {data.count === 0 && (
          <div className="mt-4">
            <div className="text-muted-foreground mb-4 mt-4 flex w-full items-center justify-center">
              <MessageSquare size={24} />
            </div>
            <div className="text-muted-foreground">
              {t(`experimentDataAnnotations.noAnnotations`)}
            </div>
            <div className="text-muted-foreground text-xs">
              {t(`experimentDataAnnotations.noAnnotationsDescription`)}
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
