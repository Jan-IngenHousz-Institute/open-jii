import React from "react";

import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";

interface DeleteAllOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  optionCount: number;
}

export function DeleteAllOptionsDialog({
  open,
  onOpenChange,
  onConfirm,
  optionCount,
}: DeleteAllOptionsDialogProps) {
  const { t } = useTranslation(["experiments"]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("questionCard.deleteAll.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("questionCard.deleteAll.description", { count: optionCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("questionCard.deleteAll.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive focus:ring-destructive"
          >
            {t("questionCard.deleteAll.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
