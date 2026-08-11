"use client";

import { useOrganizationJoinRequests } from "@/hooks/organization/join-request/useOrganizationJoinRequests/useOrganizationJoinRequests";
import { useOrganization } from "@/hooks/organization/useOrganization/useOrganization";
import { useOrganizationInvitations } from "@/hooks/organization/useOrganizationInvitations/useOrganizationInvitations";
import { useOrganizationMembers } from "@/hooks/organization/useOrganizationMembers/useOrganizationMembers";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";

import { liveInvitations } from "./organization-invitation-state";
import { OrganizationInvitations } from "./organization-invitations";
import { OrganizationInviteDialog } from "./organization-invite-dialog";
import { OrganizationJoinRequests } from "./organization-join-requests";
import { OrganizationOutsideCollaborators } from "./organization-outside-collaborators";
import { OrganizationRoster } from "./organization-roster";
import { canManageRoster, invitableRoles } from "./organization-roster-rules";

/**
 * Members, Invited and Requests as one strip rather than three routes: they are
 * three views of the same question — who is in this organization and who wants to
 * be — and the invite action belongs to all of them.
 *
 * Invited and Requests are owner/admin surfaces, so a plain member sees only the
 * roster; the endpoints behind them refuse independently.
 */
export function OrganizationMembersSurface({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();

  const { data: organization } = useOrganization(organizationId);
  const actorRole: OrganizationRole | null = organization?.role ?? null;
  const canManage = canManageRoster(actorRole);

  const {
    data: roster,
    isPending: isRosterPending,
    isError: isRosterError,
  } = useOrganizationMembers(organizationId);
  // Skip the requests behind an affordance this caller does not have; a known
  // `false` is a refusal waiting to happen, not information.
  const { data: invitations } = useOrganizationInvitations(organizationId, { enabled: canManage });
  const { data: joinRequests } = useOrganizationJoinRequests(organizationId, {
    enabled: canManage,
  });

  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const members = roster?.members ?? [];
  // Live, not merely `pending`: an expired invitation must not keep its address in
  // the "already invited" set, or re-inviting after 48 hours reads as impossible.
  const pendingInvitationEmails = liveInvitations(invitations).map(
    (invitation) => invitation.email,
  );
  const memberEmails = members
    .map((member) => member.email)
    .filter((email): email is string => email !== null);
  const pendingRequestCount = (joinRequests ?? []).filter(
    (request) => request.status === "pending",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* A page header above the strip, so the organization's own tabs and this
          page's tabs read as two levels rather than one stack of two. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("organizations.members.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("organizations.members.description")}</p>
        </div>

        {canManage && (
          <Button onClick={() => setIsInviteOpen(true)} className="shrink-0">
            <UserPlus className="h-4 w-4" />
            {t("organizations.invite.action")}
          </Button>
        )}
      </div>

      <NavTabs defaultValue="members" className="flex w-full flex-col">
        <NavTabsList>
          <NavTabsTrigger value="members">
            {t("organizations.members.tab", { count: members.length })}
          </NavTabsTrigger>
          {canManage && (
            <NavTabsTrigger value="invited">
              {t("organizations.invite.tab", { count: pendingInvitationEmails.length })}
            </NavTabsTrigger>
          )}
          {canManage && (
            <NavTabsTrigger value="requests">
              {t("organizations.requests.tab", { count: pendingRequestCount })}
            </NavTabsTrigger>
          )}
        </NavTabsList>

        <NavTabsContent value="members" className="mt-6">
          <OrganizationRoster
            organizationId={organizationId}
            members={members}
            actorRole={actorRole ?? "member"}
            isPending={isRosterPending}
            isError={isRosterError}
          />
        </NavTabsContent>

        {canManage && (
          <NavTabsContent value="invited" className="mt-6">
            <OrganizationInvitations organizationId={organizationId} />
          </NavTabsContent>
        )}

        {canManage && (
          <NavTabsContent value="requests" className="mt-6">
            <OrganizationJoinRequests organizationId={organizationId} />
          </NavTabsContent>
        )}
      </NavTabs>

      <OrganizationOutsideCollaborators collaborators={roster?.outsideCollaborators ?? []} />

      {canManage && (
        <OrganizationInviteDialog
          organizationId={organizationId}
          open={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          invitableRoles={invitableRoles(actorRole)}
          existingEmails={[...memberEmails, ...pendingInvitationEmails]}
        />
      )}
    </div>
  );
}
