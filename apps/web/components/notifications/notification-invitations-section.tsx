"use client";

import { useMyOrganizationInvitations } from "@/hooks/organization/useMyOrganizationInvitations/useMyOrganizationInvitations";
import { useLocale } from "@/hooks/useLocale";
import { Building2, CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  asOrganizationRole,
  organizationRoleLabelKey,
} from "~/components/organizations/organization-labels";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

/**
 * Organization invitations, kept apart from the notification list rather than folded
 * into it: an invitation stays actionable until it is answered, which no read state
 * captures.
 *
 * A failed read is shown as a failure. "You have no invitations" is not something to
 * infer from a refusal — Better Auth turns this endpoint down outright for an address
 * it considers unverified — and an invitation silently missing from here is exactly
 * the outcome the section exists to prevent.
 */
export function NotificationInvitationsSection({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data, isPending, isError, isFetching, refetch } = useMyOrganizationInvitations();
  const invitations = data ?? [];

  // Nothing at all while the read is in flight, and nothing once it settles empty:
  // the bell belongs to the notification list when there is no invitation to answer.
  if (isPending || (!isError && invitations.length === 0)) return null;

  return (
    <div className="border-b" data-testid="bell-invitations">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold">{t("organizations.myInvitations.title")}</h3>
      </div>
      {isError ? (
        <div
          className="text-muted-foreground flex flex-col items-start gap-2 px-4 pb-3 text-xs"
          data-testid="bell-invitations-error"
        >
          <span className="text-foreground inline-flex items-center gap-2">
            <CircleAlert className="text-destructive size-4 shrink-0" aria-hidden />
            {t("organizations.myInvitations.loadError")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching && <Loader2 className="mr-2 size-3 animate-spin" aria-hidden />}
            {t("organizations.myInvitations.retry")}
          </Button>
        </div>
      ) : (
        <ul className="max-h-[220px] divide-y overflow-y-auto border-t">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              {/* The tab, not a per-invitation address: an invitation belongs to an
                  email address, so the list this account is entitled to is the whole
                  of what there is to open. */}
              <Link
                href={`/${locale}/platform/account/invitations`}
                onClick={onNavigate}
                className="hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-hidden flex items-start gap-3 px-4 py-3 transition-colors"
              >
                <Building2 className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invitation.organizationName}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t("organizations.acceptInvitation.roleLabel")}{" "}
                    {t(organizationRoleLabelKey(asOrganizationRole(invitation.role)))}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
