import React from "react";
import { useExperimentDeleteAnnotationsBulk } from "~/hooks/experiment/useExperimentDeleteAnnotationsBulk/useExperimentDeleteAnnotationsBulk";

import type { AnnotationType } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

export interface DeleteAnnotationsDialogProps {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  type: AnnotationType;
  bulkOpen: boolean;
  setBulkOpen: (value: React.SetStateAction<boolean>) => void;
  clearSelection: () => void;
}

export function DeleteAnnotationsDialog({
  experimentId,
  tableName,
  rowIds,
  type,
  bulkOpen,
  setBulkOpen,
  clearSelection,
}: DeleteAnnotationsDialogProps) {
  const { mutateAsync: deleteAnnotationsBulk } = useExperimentDeleteAnnotationsBulk();
  const { t } = useTranslation();
  const count = rowIds.length;

  async function onDelete() {
    await deleteAnnotationsBulk({
      params: { id: experimentId },
      body: { tableName, rowIds, type },
    });
    toast({ description: t(`experimentDataAnnotations.deleted.${type}s`) });
    clearSelection();
    setBulkOpen(false);
  }

  return (
    <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`experimentDataAnnotations.${type}DeleteDialog.title`)}</DialogTitle>
          <DialogDescription>
            {t(`experimentDataAnnotations.${type}DeleteDialog.description`, { count })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common.cancel")}</Button>
          </DialogClose>
          <Button type="submit" onClick={onDelete}>
            {t(`experimentDataAnnotations.${type}DeleteDialog.delete`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
