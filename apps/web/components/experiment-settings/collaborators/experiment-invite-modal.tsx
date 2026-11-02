"use client";

import { CollaboratorInviteDialog } from "@/components/sharing/collaborator-invite-dialog";
import type { ExistingGrant } from "@/components/sharing/share-candidates";
import { useEffect } from "react";

import type { ShareableRole } from "@repo/api/domains/sharing/sharing.schema";
import type { Invitation } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { useUserInvitationCreate } from "../../../hooks/user-invitation/useUserInvitationCreate/useUserInvitationCreate";

interface ExperimentInviteModalProps {
  experimentId: string;
  invitations: Invitation[];
  /** Grants already on the experiment, with their levels. */
  existingGrants?: ExistingGrant[];
  owningOrganizationId?: string | null;
  isArchived: boolean;
  /** `can(share)`: losing it mid-session takes the form away, not just the button. */
  canShare: boolean;
  /** Everyone can already read a public experiment, which changes what a tier buys. */
  isPublic?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Invites an account, organization, or email with the selected experiment tier. */
export function ExperimentInviteModal({
  experimentId,
  invitations,
  existingGrants,
  owningOrganizationId,
  isArchived,
  canShare,
  isPublic = false,
  open,
  onOpenChange,
}: ExperimentInviteModalProps) {
  const { t } = useTranslation();

  const { mutateAsync: createInvitation, isPending: isCreatingInvitation } =
    useUserInvitationCreate();

  // A refetch can take `share` away while this is open — a demotion in another
  // tab, an archive, a grant revoked underneath. The form is inert either way via
  // `disabled`, but leaving an open invite dialog on screen invites a submission
  // the server would only refuse, so close it.
  useEffect(() => {
    if (open && !canShare) onOpenChange(false);
  }, [open, canShare, onOpenChange]);

  const handleEmailInvite = async (email: string, tier: ShareableRole) => {
    await createInvitation({
      resourceType: "experiment",
      resourceId: experimentId,
      email,
      tier,
    });
    toast({ description: t("experimentSettings.invitationSent") });
  };

  return (
    <CollaboratorInviteDialog
      resourceType="experiment"
      resourceId={experimentId}
      open={open}
      onOpenChange={onOpenChange}
      title={t("experimentSettings.inviteCollaborators")}
      description={t("experimentSettings.inviteCollaboratorsDescription")}
      disabled={isArchived || !canShare}
      existingGrants={existingGrants}
      owningOrganizationId={owningOrganizationId}
      existingEmails={invitations.flatMap((invitation) => invitation.email ?? [])}
      onEmailInvite={handleEmailInvite}
      isEmailInvitePending={isCreatingInvitation}
      hint={isPublic ? t("sharing.publicExperimentTierHint") : t("sharing.experimentTierHint")}
    />
  );
}
