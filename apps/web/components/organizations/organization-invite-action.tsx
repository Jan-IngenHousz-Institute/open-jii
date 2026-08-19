"use client";

import { useOrganizationInvitations } from "@/hooks/organization/useOrganizationInvitations/useOrganizationInvitations";
import { useOrganizationMembers } from "@/hooks/organization/useOrganizationMembers/useOrganizationMembers";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { liveInvitations } from "./organization-invitation-state";
import { OrganizationInviteDialog } from "./organization-invite-dialog";
import { invitableRoles } from "./organization-roster-rules";

/**
 * Inviting somebody, from the organization's own header rather than from the roster:
 * it is the one thing an owner or admin does often enough to want reachable from
 * every one of the organization's routes.
 *
 * The dialog and the two reads it needs — who is already on the roster, who already
 * has a live invitation — are mounted only once it is opened. A button present on
 * four routes must not cost two requests on all four.
 */
export function OrganizationInviteAction({
  organizationId,
  actorRole,
}: {
  organizationId: string;
  actorRole: OrganizationRole;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button className="shrink-0" onClick={() => setIsOpen(true)}>
        <UserPlus className="h-4 w-4" />
        {t("organizations.invite.action")}
      </Button>

      {isOpen && (
        <InviteDialogWithExclusions
          organizationId={organizationId}
          actorRole={actorRole}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

/** Mounted only while open, so its two reads only ever run for somebody inviting. */
function InviteDialogWithExclusions({
  organizationId,
  actorRole,
  onClose,
}: {
  organizationId: string;
  actorRole: OrganizationRole;
  onClose: () => void;
}) {
  const { data: roster } = useOrganizationMembers(organizationId);
  const { data: invitations } = useOrganizationInvitations(organizationId);

  const members = roster?.members ?? [];

  return (
    <OrganizationInviteDialog
      organizationId={organizationId}
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      invitableRoles={invitableRoles(actorRole)}
      memberUserIds={members.map((member) => member.userId)}
      memberEmails={members
        .map((member) => member.email)
        .filter((email): email is string => email !== null)}
      // Live, not merely `pending`: an expired invitation must not keep its address
      // in the "already invited" set, or re-inviting after 48 hours reads as
      // impossible.
      pendingInvitationEmails={liveInvitations(invitations).map((invitation) => invitation.email)}
    />
  );
}
