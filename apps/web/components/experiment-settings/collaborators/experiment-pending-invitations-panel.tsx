"use client";

import { Mail } from "lucide-react";

import type { ExperimentMemberRole } from "@repo/api/schemas/experiment.schema";
import type { Invitation } from "@repo/api/schemas/user.schema";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

import { useUserInvitationRevoke } from "../../../hooks/user-invitation/useUserInvitationRevoke/useUserInvitationRevoke";
import { useUserInvitationRoleUpdate } from "../../../hooks/user-invitation/useUserInvitationRoleUpdate/useUserInvitationRoleUpdate";

interface ExperimentPendingInvitationsPanelProps {
  invitations: Invitation[];
  isArchived?: boolean;
  isAdmin: boolean;
}

export function ExperimentPendingInvitationsPanel({
  invitations,
  isArchived = false,
  isAdmin,
}: ExperimentPendingInvitationsPanelProps) {
  const { t } = useTranslation();
  const { mutate: revokeInvitation } = useUserInvitationRevoke();
  const { mutate: updateInvitationRole } = useUserInvitationRoleUpdate();

  const handleInvitationValueChange = (value: string, invitation: Invitation) => {
    if (value === "revoke") {
      revokeInvitation(
        { params: { invitationId: invitation.id } },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.invitationRevoked") });
          },
        },
      );
    } else {
      updateInvitationRole(
        {
          params: { invitationId: invitation.id },
          body: { role: value as ExperimentMemberRole },
        },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.roleUpdated") });
          },
        },
      );
    }
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
    <div className="space-y-2">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="border-border flex items-center gap-3 rounded-lg border px-3 py-2.5"
        >
          <div className="bg-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Mail className="text-muted-foreground h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-foreground truncate text-sm font-medium" title={invitation.email}>
              {invitation.email}
            </span>
            <span className="bg-badge-published text-primary inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium">
              {t("experimentSettings.pendingInvite")}
            </span>
          </div>
          <div className="flex flex-shrink-0">
            <Select
              value={invitation.role}
              disabled={isArchived || !isAdmin}
              onValueChange={(value) => handleInvitationValueChange(value, invitation)}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{t("experimentSettings.roleAdmin")}</SelectItem>
                <SelectItem value="member">{t("experimentSettings.roleMember")}</SelectItem>
                <SelectSeparator />
                <SelectItem value="revoke" className="text-destructive focus:text-destructive">
                  {t("experimentSettings.revoke")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}
