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

interface DeleteDeviceGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  isPending: boolean;
  onConfirm: () => void;
}

export function DeleteDeviceGroupDialog({
  open,
  onOpenChange,
  groupName,
  isPending,
  onConfirm,
}: DeleteDeviceGroupDialogProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("iot.groups.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("iot.groups.deleteHint", { name: groupName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{tCommon("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : t("iot.groups.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
