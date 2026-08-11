"use client";

import { useOrganizationInvitation } from "@/hooks/organization/useOrganizationInvitation/useOrganizationInvitation";
import { useRespondToOrganizationInvitation } from "@/hooks/organization/useRespondToOrganizationInvitation/useRespondToOrganizationInvitation";
import { useLocale } from "@/hooks/useLocale";
import { MailX, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  authErrorMessage,
  isWrongRecipientError,
} from "~/hooks/organization/auth-organization-result";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "@repo/ui/hooks/use-toast";

import { asOrganizationRole, organizationRoleLabelKey } from "./organization-labels";
import { organizationPath, organizationsPath } from "./organization-routes";

/**
 * Where an invitation email lands. The route sits inside the platform, so a
 * signed-out recipient is sent to sign in first and comes back here — by which
 * point the invitation is usually already accepted, because signing in with an
 * invited address accepts every pending invitation for it. That is the documented
 * behaviour, not a race, and it is why the unavailable state is a normal outcome
 * here rather than an error.
 *
 * Better Auth serves only *pending* invitations, so an accepted, declined, withdrawn
 * or expired one is indistinguishable from here — a single state covers all four. It
 * cannot name the organization either, which is why that state offers the
 * organization list rather than a link the page has no way to build.
 *
 * An invitation opened by the wrong account is a different matter and gets its own
 * state: Better Auth answers 403 there rather than 400, the invitation is still live,
 * and telling the genuine recipient it no longer exists would send them away from an
 * invitation they can still accept — after signing in as the invited address.
 */
export function AcceptOrganizationInvitation({ invitationId }: { invitationId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = useLocale();

  const { data: invitation, isPending, isError, error } = useOrganizationInvitation(invitationId);
  const isWrongAccount = isError && isWrongRecipientError(error);
  const { mutateAsync: respond, isPending: isResponding } = useRespondToOrganizationInvitation();

  const currentPath = `/platform/accept-invitation/${invitationId}`;

  const submit = async (decision: "accept" | "reject") => {
    try {
      const result = await respond({ invitationId, decision });
      if (decision === "reject") {
        toast({ description: t("organizations.acceptInvitation.declined") });
        router.push(organizationsPath(locale));
        return;
      }
      toast({
        description: t("organizations.acceptInvitation.accepted", {
          name: invitation?.organizationName ?? "",
        }),
      });
      // The membership row names the organization, so there is nothing to re-read
      // to know where to go.
      const organizationId =
        result && "member" in result ? result.member?.organizationId : invitation?.organizationId;
      router.push(
        organizationId ? organizationPath(locale, organizationId) : organizationsPath(locale),
      );
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.acceptInvitation.failed"),
        variant: "destructive",
      });
    }
  };

  if (isPending) {
    return (
      <div aria-busy="true" className="flex max-w-lg flex-col gap-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  if (isWrongAccount) {
    return (
      <div className="border-border max-w-lg rounded-lg border px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <UserX className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">
          {t("organizations.acceptInvitation.wrongAccountTitle")}
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-[420px] text-xs leading-relaxed">
          {t("organizations.acceptInvitation.wrongAccountHint")}
        </p>
        <Button asChild className="mt-4">
          {/* Straight to sign-in, carrying this page as the destination: the
              invitation is still live, so the way through is the invited address. */}
          <Link href={`/${locale}/login?callbackUrl=${encodeURIComponent(currentPath)}`}>
            {t("organizations.acceptInvitation.switchAccount")}
          </Link>
        </Button>
      </div>
    );
  }

  if (isError || !invitation) {
    return (
      <div className="border-border max-w-lg rounded-lg border px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <MailX className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">
          {t("organizations.acceptInvitation.unavailableTitle")}
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-[420px] text-xs leading-relaxed">
          {t("organizations.acceptInvitation.unavailableHint")}
        </p>
        <Button asChild className="mt-4">
          <Link href={organizationsPath(locale)}>
            {t("organizations.acceptInvitation.goToOrganizations")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border flex max-w-lg flex-col gap-4 rounded-lg border p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">
          {t("organizations.acceptInvitation.title", { name: invitation.organizationName })}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("organizations.acceptInvitation.description", {
            inviter: invitation.inviterEmail,
            name: invitation.organizationName,
          })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {t("organizations.acceptInvitation.roleLabel")}
        </span>
        <Badge variant="outline" className="text-xs font-normal">
          {t(organizationRoleLabelKey(asOrganizationRole(invitation.role)))}
        </Badge>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void submit("accept")} disabled={isResponding}>
          {isResponding
            ? t("organizations.acceptInvitation.working")
            : t("organizations.acceptInvitation.acceptAction")}
        </Button>
        <Button variant="outline" onClick={() => void submit("reject")} disabled={isResponding}>
          {t("organizations.acceptInvitation.declineAction")}
        </Button>
      </div>
    </div>
  );
}
