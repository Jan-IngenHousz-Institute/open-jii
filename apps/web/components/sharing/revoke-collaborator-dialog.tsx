"use client";

import { AlertTriangle } from "lucide-react";

import type { ShareableRole } from "@repo/api/domains/sharing/sharing.schema";
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

import { shareableRoleLabelKey } from "./collaborator-roles";

/** Access the revoke cannot touch, when the list knows of some. */
export interface RetainedAccess {
  organizationName: string;
  organizationRole: "owner" | "admin" | "member";
  /** What that role alone leaves them with, once the grant is gone. */
  tier: ShareableRole;
}

// Literal keys, spelled out: an interpolated one is invisible to the string guard.
const ACCESS_SOURCE_LABEL = {
  owner: "sharing.accessSourceOrgOwner",
  admin: "sharing.accessSourceOrgAdmin",
  member: "sharing.accessSourceOrgMember",
} as const;

interface RevokeCollaboratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  granteeName: string;
  isRevoking: boolean;
  /** Blocks confirm without closing the dialog (e.g. the surface went read-only). */
  confirmDisabled?: boolean;
  /** The grant belongs to the signed-in user, so this is "leave", not "remove". */
  isSelf?: boolean;
  /** Org-derived access that survives this, when it is known. */
  retainedAccess?: RetainedAccess | null;
  onConfirm: () => void;
}

/**
 * Revoking removes only this grant, so organization, another grant, or public
 * access may survive. Self-leave reuses the same operation and caveat under
 * caller-focused wording instead of implying all access is necessarily lost.
 *
 * Where the row resolved an organization role, the outcome is stated as fact instead:
 * "may still" is the right hedge for what nothing here can compute — a team grant,
 * public visibility — and the wrong one for something already known, which on a
 * self-leave reads as having locked yourself out.
 */
export function RevokeCollaboratorDialog({
  open,
  onOpenChange,
  granteeName,
  isRevoking,
  confirmDisabled = false,
  isSelf = false,
  retainedAccess = null,
  onConfirm,
}: RevokeCollaboratorDialogProps) {
  const { t } = useTranslation();

  const retained = retainedAccess
    ? t(isSelf ? "sharing.leaveKeepsAccess" : "sharing.revokeKeepsAccess", {
        name: granteeName,
        tier: t(shareableRoleLabelKey(retainedAccess.tier)),
        source: t(ACCESS_SOURCE_LABEL[retainedAccess.organizationRole], {
          organization: retainedAccess.organizationName,
        }),
      })
    : null;

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
            {retained ??
              (isSelf
                ? t("sharing.leaveOtherAccessWarning")
                : t("sharing.revokeOtherAccessWarning"))}
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
