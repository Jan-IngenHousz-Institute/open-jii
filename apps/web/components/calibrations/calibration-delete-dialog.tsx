"use client";

import { Loader2 } from "lucide-react";

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

interface CalibrationDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definitionName: string;
  isPending: boolean;
  onConfirm: () => void;
}

export function CalibrationDeleteDialog({
  open,
  onOpenChange,
  definitionName,
  isPending,
  onConfirm,
}: CalibrationDeleteDialogProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      onOpenChange(next);
    }
  }

  // The action would close the dialog on click; it stays open on its spinner until the
  // delete lands and the page navigates away, or fails and says why.
  function handleConfirm(event: React.MouseEvent) {
    event.preventDefault();
    onConfirm();
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("iot.calibration.detail.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("iot.calibration.detail.deleteHint", { name: definitionName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{tCommon("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("iot.calibration.detail.delete")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
