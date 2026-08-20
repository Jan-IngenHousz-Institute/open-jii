"use client";

import { useCancelOrganizationInvitation } from "@/hooks/organization/useCancelOrganizationInvitation/useCancelOrganizationInvitation";
import { useOrganizationInvitations } from "@/hooks/organization/useOrganizationInvitations/useOrganizationInvitations";
import { useOrganizationMembers } from "@/hooks/organization/useOrganizationMembers/useOrganizationMembers";
import { formatDate } from "@/util/date";
import { Mail, MailOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { liveInvitations } from "./organization-invitation-state";
import { asOrganizationRole, organizationRoleLabelKey } from "./organization-labels";

/**
 * Pending invitations. Only the live ones are shown: an accepted invitation is a
 * member and belongs on the roster, and a declined one is not something to act on.
 *
 * Expiry has to be checked alongside the status, not inferred from it — Better Auth
 * refuses an expired invitation but leaves its stored status `pending`, so a past-due
 * row would otherwise sit here looking actionable forever.
 *
 * There is no resend: Better Auth has no such primitive, and cancelling plus
 * re-inviting mints a new id and a fresh expiry — which is what the two controls
 * already offered here amount to.
 */
export function OrganizationInvitations({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError } = useOrganizationInvitations(organizationId);
  const { mutateAsync: cancelInvitation } = useCancelOrganizationInvitation(organizationId);
  // Who sent it, resolved against the roster the surface has already loaded rather
  // than through a join: the inviter is a member of this organization in all but the
  // case where they have since left, and that row simply loses the attribution.
  const { data: roster } = useOrganizationMembers(organizationId);

  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);

  const invitations = liveInvitations(data);
  const inviterNames = new Map(
    (roster?.members ?? []).map((member) => [
      member.userId,
      `${member.firstName} ${member.lastName}`.trim() || member.email,
    ]),
  );

  const revoke = async (invitationId: string, email: string) => {
    setBusyInvitationId(invitationId);
    try {
      await cancelInvitation({ invitationId });
      toast({ description: t("organizations.invite.cancelled", { email }) });
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.invite.cancelFailed"),
        variant: "destructive",
      });
    } finally {
      setBusyInvitationId(null);
    }
  };

  if (isError) {
    return <p className="text-destructive text-sm">{t("organizations.invite.loadFailed")}</p>;
  }

  if (isPending) {
    return (
      <Card aria-busy="true" className="divide-border divide-y overflow-hidden">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </Card>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card className="px-6 py-11 text-center">
        {/* Grey, deliberately: an empty state is not a brand moment, and the design
            keeps its own empty-state circles on surface grey too. The pale-teal
            treatment is reserved for the organization's identity mark and its stats. */}
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <MailOpen className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-foreground text-sm font-semibold">
          {t("organizations.invite.emptyTitle")}
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
          {t("organizations.invite.emptyHint")}
        </p>
      </Card>
    );
  }

  return (
    <Card role="list" className="divide-border divide-y overflow-hidden">
      {invitations.map((invitation) => {
        const inviter = inviterNames.get(invitation.inviterId);
        const expiry = t("organizations.invite.expiresOn", {
          date: formatDate(invitation.expiresAt.toString()),
        });

        return (
          <div role="listitem" key={invitation.id} className="flex items-center gap-3 px-5 py-3">
            {/* Also grey, and the design agrees — its invitation rows sit on surface.
                A pale-teal chip on every pending row would compete with the
                organization's own mark a few pixels above it. */}
            <div className="bg-muted text-muted-foreground grid h-9 w-9 shrink-0 place-items-center rounded-full">
              <Mail className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{invitation.email}</p>
              <p className="text-muted-foreground truncate text-xs">
                {inviter
                  ? t("organizations.invite.invitedByAndExpiry", { name: inviter, expiry })
                  : expiry}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              {t(organizationRoleLabelKey(asOrganizationRole(invitation.role)))}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void revoke(invitation.id, invitation.email)}
              disabled={busyInvitationId === invitation.id}
              aria-label={t("organizations.invite.cancelForLabel", { email: invitation.email })}
              className="text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </Card>
  );
}
