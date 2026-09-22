"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useMyOrganizationInvitations } from "@/hooks/organization/useMyOrganizationInvitations/useMyOrganizationInvitations";
import { useRespondToOrganizationInvitation } from "@/hooks/organization/useRespondToOrganizationInvitation/useRespondToOrganizationInvitation";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { Building2, CircleAlert, Loader2, MailOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  asOrganizationRole,
  organizationRoleLabelKey,
} from "~/components/organizations/organization-labels";
import {
  organizationPath,
  organizationsPath,
} from "~/components/organizations/organization-routes";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Every organization invitation waiting for this account, and the only place they can
 * be answered. It is where the invitation email lands, and it is addressed by nothing
 * finer than the account: an invitation belongs to an email address, so the list the
 * signed-in address is entitled to *is* the answer — there is no other invitation to
 * name, and one sent to a different address is simply not here.
 *
 * Nothing accepts an invitation on the recipient's behalf, whatever role it carries: a
 * membership reaches everything the organization owns, and an `admin` or `owner` role
 * makes them answerable for other people's work. The accept below is the whole
 * transaction.
 *
 * A failed read renders as a failure, never as an empty list. Better Auth refuses this
 * endpoint outright for an address it considers unverified — regardless of
 * `requireEmailVerificationOnInvitation` — and "you have no invitations" is the one
 * answer that must not be invented on its behalf.
 */
export function MyInvitationsCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = useLocale();

  const { data, isPending, isError, isFetching, refetch } = useMyOrganizationInvitations();
  const { mutateAsync: respond } = useRespondToOrganizationInvitation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const invitations = data ?? [];

  const submit = async (
    invitation: { id: string; organizationId: string; organizationName: string },
    decision: "accept" | "reject",
  ) => {
    setBusyId(invitation.id);
    try {
      const result = await respond({ invitationId: invitation.id, decision });
      if (decision === "reject") {
        // Declining leaves the recipient where they are: the row goes, the rest of
        // the list is still theirs to answer.
        toast({ description: t("organizations.acceptInvitation.declined") });
        return;
      }
      toast({
        description: t("organizations.acceptInvitation.accepted", {
          name: invitation.organizationName,
        }),
      });
      // The membership row names the organization, so there is nothing to re-read to
      // know where to go.
      const organizationId =
        result && "member" in result ? result.member?.organizationId : invitation.organizationId;
      router.push(
        organizationId ? organizationPath(locale, organizationId) : organizationsPath(locale),
      );
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.acceptInvitation.failed"),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SettingsCard
      title={t("organizations.myInvitations.title")}
      description={t("organizations.myInvitations.description")}
      data-testid="my-invitations-card"
    >
      {isPending ? (
        <div className="space-y-2" aria-busy="true" data-testid="my-invitations-loading">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div
          className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-sm"
          data-testid="my-invitations-error"
        >
          <CircleAlert className="text-destructive h-8 w-8" aria-hidden />
          <p>{t("organizations.myInvitations.loadError")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {t("organizations.myInvitations.retry")}
          </Button>
        </div>
      ) : invitations.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
          <MailOpen className="h-8 w-8 opacity-50" aria-hidden />
          <p className="text-foreground font-semibold">{t("organizations.myInvitations.empty")}</p>
          {/* The address is the whole of the matching rule, and getting it wrong is
                the usual reason an expected invitation is not here — so the empty
                state says so rather than leaving a dead end. */}
          <p className="max-w-[380px] text-xs leading-relaxed">
            {t("organizations.myInvitations.emptyHint")}
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {invitations.map((invitation) => {
            const name = invitation.organizationName;
            const role = t(organizationRoleLabelKey(asOrganizationRole(invitation.role)));

            return (
              <li
                key={invitation.id}
                data-testid="my-invitation-row"
                className="flex flex-wrap items-center gap-4 px-4 py-3.5"
              >
                <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Building2 className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t("organizations.invite.expiresOn", {
                      date: formatDate(invitation.expiresAt.toString()),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {t("organizations.acceptInvitation.roleLabel")}
                  </span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {role}
                  </Badge>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    aria-label={t("organizations.myInvitations.acceptNamed", { name })}
                    disabled={busyId === invitation.id}
                    onClick={() => void submit(invitation, "accept")}
                  >
                    {busyId === invitation.id
                      ? t("organizations.acceptInvitation.working")
                      : t("organizations.acceptInvitation.acceptAction")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={t("organizations.myInvitations.declineNamed", { name })}
                    disabled={busyId === invitation.id}
                    onClick={() => void submit(invitation, "reject")}
                  >
                    {t("organizations.acceptInvitation.declineAction")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SettingsCard>
  );
}
