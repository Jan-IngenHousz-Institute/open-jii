"use client";

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
          <AlertDialogCancel>{t("iot.groups.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {t("iot.groups.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
