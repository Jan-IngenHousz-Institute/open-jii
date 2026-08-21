"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import { Mail, X } from "lucide-react";

import type { Invitation } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { useUserInvitationRevoke } from "../../../hooks/user-invitation/useUserInvitationRevoke/useUserInvitationRevoke";
import { roleLabelKey } from "../../sharing/collaborator-roles";

interface ExperimentPendingInvitationsPanelProps {
  invitations: Invitation[];
  isArchived?: boolean;
  /** `can(share)`: the capability that owns who gets access, invitations included. */
  canRevoke: boolean;
}

/** Pending invitations with their fixed acceptance tier. */
export function ExperimentPendingInvitationsPanel({
  invitations,
  isArchived = false,
  canRevoke,
}: ExperimentPendingInvitationsPanelProps) {
  const { t } = useTranslation();
  const { mutate: revokeInvitation } = useUserInvitationRevoke();

  const handleRevoke = (invitation: Invitation) => {
    revokeInvitation(
      { invitationId: invitation.id },
      {
        onSuccess: () => {
          toast({ description: t("experimentSettings.invitationRevoked") });
        },
      },
    );
  };

  if (invitations.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <Mail className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">
          {t("experimentSettings.noInvitations")}
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-[280px] text-xs leading-relaxed">
          {t("experimentSettings.noInvitationsHint")}
        </p>
      </div>
    );
  }

  return (
    <div
      role="list"
      className="border-border divide-border divide-y overflow-hidden rounded-lg border"
    >
      {invitations.map((invitation) => (
        <div key={invitation.id} role="listitem" className="flex items-center gap-3 px-3 py-2.5">
          <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Mail className="text-muted-foreground h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-foreground truncate text-sm font-medium" title={invitation.email}>
              {invitation.email}
            </span>
            <StatusBadge tone="published">{t("experimentSettings.pendingInvite")}</StatusBadge>
          </div>
          <span className="text-muted-foreground shrink-0 text-sm">
            {t(roleLabelKey(invitation.tier))}
          </span>
          <div className="flex shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isArchived || !canRevoke}
              onClick={() => handleRevoke(invitation)}
            >
              <X className="h-4 w-4" />
              {t("experimentSettings.revoke")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
