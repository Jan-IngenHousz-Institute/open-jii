import React from "react";
import { useExperimentDataCommentsDelete } from "~/hooks/experiment/useExperimentDataCommentsDelete/useExperimentDataCommentsDelete";

import type { DeleteExperimentDataComments } from "@repo/api";
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

export interface DeleteCommentsDialogProps {
  experimentId: string;
  tableName: string;
  rowIds: string[];
  type: "comment" | "flag";
  bulkOpen: boolean;
  setBulkOpen: (value: React.SetStateAction<boolean>) => void;
  clearSelection: () => void;
}

export function DeleteCommentsDialog({
  experimentId,
  tableName,
  rowIds,
  type,
  bulkOpen,
  setBulkOpen,
  clearSelection,
}: DeleteCommentsDialogProps) {
  const { mutateAsync: deleteComment } = useExperimentDataCommentsDelete();
  const { t } = useTranslation();
  const count = rowIds.length;

  async function onDelete() {
    const data: DeleteExperimentDataComments = {
      rowIds,
      type,
    };
    await deleteComment({
      params: { id: experimentId, tableName },
      body: data,
    });
    toast({ description: t(`experimentDataComments.deleted.${type}s`) });
    clearSelection();
    setBulkOpen(false);
  }

  return (
    <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`experimentDataComments.${type}DeleteDialog.title`)}</DialogTitle>
          <DialogDescription>
            {t(`experimentDataComments.${type}DeleteDialog.description`, { count })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common.cancel")}</Button>
          </DialogClose>
          <Button type="submit" onClick={onDelete}>
            {t(`experimentDataComments.${type}DeleteDialog.delete`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
