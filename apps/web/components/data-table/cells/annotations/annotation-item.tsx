"use client";

import { Flag } from "lucide-react";
import { formatDate } from "~/util/date";

import type {
  ExperimentAnnotation,
  ExperimentAnnotationFlagContent,
  ExperimentAnnotationFlagType,
} from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

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

export function AnnotationItem({
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
