"use client";

import { Flag, Trash2 } from "lucide-react";
import type { OnAnnotationHandler } from "~/components/data-table/data-table-columns";

import type { ExperimentAnnotation } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { AnnotationItem } from "./annotation-item";

interface FlagsPopoverContentProps {
  flags: ExperimentAnnotation[];
  rowId: string;
  onAddAnnotation?: OnAnnotationHandler;
  onDeleteAnnotations?: OnAnnotationHandler;
}

export function FlagsPopoverContent({
  flags,
  rowId,
  onAddAnnotation,
  onDeleteAnnotations,
}: FlagsPopoverContentProps) {
  const { t } = useTranslation();

  return (
    <>
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
    </>
  );
}
