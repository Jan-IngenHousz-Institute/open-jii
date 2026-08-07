"use client";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

interface PublishConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

/** Confirms the irreversible private-to-public transition. */
export function PublishConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: PublishConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("resourceVisibility.publishConfirmTitle")}</DialogTitle>
          <DialogDescription>{t("resourceVisibility.publishConfirmDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending
              ? t("resourceVisibility.publishing")
              : t("resourceVisibility.publishConfirmButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
