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

interface FreezeConfirmDialogProps {
  version: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

/** Confirms the irreversible freeze, as the publish confirm dialog does for going public. */
export function FreezeConfirmDialog({
  version,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: FreezeConfirmDialogProps) {
  const { t } = useTranslation("datasets");

  const handleCancel = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="freeze-confirm-dialog">
        <DialogHeader>
          <DialogTitle>{t("freeze.confirmTitle", { version })}</DialogTitle>
          <DialogDescription>{t("freeze.confirmDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            {t("freeze.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? t("freeze.freezing") : t("freeze.confirm", { version })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
