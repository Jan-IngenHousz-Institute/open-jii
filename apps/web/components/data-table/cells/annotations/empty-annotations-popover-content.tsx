"use client";

import { Flag, MessageSquare } from "lucide-react";
import type { OnAnnotationHandler } from "~/components/data-table/data-table-columns";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface EmptyAnnotationsPopoverContentProps {
  rowId: string;
  onAddAnnotation: OnAnnotationHandler;
}

export function EmptyAnnotationsPopoverContent({
  rowId,
  onAddAnnotation,
}: EmptyAnnotationsPopoverContentProps) {
  const { t } = useTranslation();

  return (
    <>
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
    </>
  );
}
