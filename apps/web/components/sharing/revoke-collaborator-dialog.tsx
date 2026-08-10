"use client";

import { AlertTriangle } from "lucide-react";

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

interface RevokeCollaboratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  granteeName: string;
  isRevoking: boolean;
  /** Blocks confirm without closing the dialog (e.g. the surface went read-only). */
  confirmDisabled?: boolean;
  /** The grant belongs to the signed-in user, so this is "leave", not "remove". */
  isSelf?: boolean;
  onConfirm: () => void;
}

/**
 * Revoking removes only this grant, so organization, another grant, or public
 * access may survive. Self-leave reuses the same operation and caveat under
 * caller-focused wording instead of implying all access is necessarily lost.
 */
export function RevokeCollaboratorDialog({
  open,
  onOpenChange,
  granteeName,
  isRevoking,
  confirmDisabled = false,
  isSelf = false,
  onConfirm,
}: RevokeCollaboratorDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSelf ? t("sharing.leaveTitle") : t("sharing.revokeTitle")}</DialogTitle>
          <DialogDescription>
            {isSelf
              ? t("sharing.leaveDescription")
              : t("sharing.revokeDescription", { name: granteeName })}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-surface-light text-muted-foreground flex items-start gap-2 rounded-md p-3 text-xs">
          <AlertTriangle className="text-primary mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-snug">
            {isSelf ? t("sharing.leaveOtherAccessWarning") : t("sharing.revokeOtherAccessWarning")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRevoking}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isRevoking || confirmDisabled}
          >
            {isRevoking
              ? t("sharing.revoking")
              : isSelf
                ? t("sharing.leaveConfirm")
                : t("sharing.revokeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
