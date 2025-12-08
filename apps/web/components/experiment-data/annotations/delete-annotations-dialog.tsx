import React from "react";
import { useExperimentAnnotationDeleteBulk } from "~/hooks/experiment/annotations/useExperimentAnnotationDeleteBulk/useExperimentAnnotationDeleteBulk";

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
  open: boolean;
  setOpen: (value: React.SetStateAction<boolean>) => void;
  clearSelection: () => void;
}

export function DeleteAnnotationsDialog({
  experimentId,
  tableName,
  rowIds,
  type,
  open,
  setOpen,
  clearSelection,
}: DeleteAnnotationsDialogProps) {
  const { mutateAsync: deleteAnnotationsBulk, isPending } = useExperimentAnnotationDeleteBulk();
  const { t } = useTranslation();
  const count = rowIds.length;
  const isPendingSuffix = isPending ? "Pending" : "";

  async function onDelete() {
    await deleteAnnotationsBulk({
      params: { id: experimentId },
      body: { tableName, rowIds, type },
    });
    toast({ description: t(`experimentDataAnnotations.deleted.${type}s`) });
    clearSelection();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <Button type="submit" onClick={onDelete} disabled={isPending}>
            {t(`experimentDataAnnotations.${type}DeleteDialog.delete${isPendingSuffix}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
