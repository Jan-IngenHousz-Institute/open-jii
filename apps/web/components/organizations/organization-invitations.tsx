"use client";

import { useCancelOrganizationInvitation } from "@/hooks/organization/useCancelOrganizationInvitation/useCancelOrganizationInvitation";
import { useOrganizationInvitations } from "@/hooks/organization/useOrganizationInvitations/useOrganizationInvitations";
import { formatDate } from "@/util/date";
import { MailOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
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
 */
export function OrganizationInvitations({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError } = useOrganizationInvitations(organizationId);
  const { mutateAsync: cancelInvitation } = useCancelOrganizationInvitation(organizationId);

  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);

  const invitations = liveInvitations(data);

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
      <div
        aria-busy="true"
        className="border-border divide-border divide-y overflow-hidden rounded-lg border"
      >
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="border-border rounded-lg border px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <MailOpen className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">
          {t("organizations.invite.emptyTitle")}
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-[380px] text-xs leading-relaxed">
          {t("organizations.invite.emptyHint")}
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
        <div role="listitem" key={invitation.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{invitation.email}</p>
            <p className="text-muted-foreground text-xs">
              {t("organizations.invite.expiresOn", {
                date: formatDate(invitation.expiresAt.toString()),
              })}
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
      ))}
    </div>
  );
}
