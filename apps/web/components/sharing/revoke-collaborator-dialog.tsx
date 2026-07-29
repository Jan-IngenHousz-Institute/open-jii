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
 * Revoke confirmation.
 *
 * Carries the caveat that revoking removes *this grant only*. The grantee may
 * still reach the resource through another precedence tier — an owner/admin role
 * in the owning organization, that organization's base permission, another
 * grant (team or organization), or public visibility. Removing access entirely
 * means checking those too, so the dialog says so rather than implying the
 * revoke is sufficient.
 *
 * Giving up one's own grant is the same operation seen from the other side, so it
 * reuses this dialog under "leave" wording: what is lost is the caller's own
 * access, and the caveat becomes the reassurance that they may still be able to
 * read the resource by another route.
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
