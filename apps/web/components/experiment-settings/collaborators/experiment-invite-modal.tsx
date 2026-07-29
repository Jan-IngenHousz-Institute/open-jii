"use client";

import { CollaboratorInviteDialog } from "@/components/sharing/collaborator-invite-dialog";
import { useEffect } from "react";

import type { Invitation } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { useUserInvitationCreate } from "../../../hooks/user-invitation/useUserInvitationCreate/useUserInvitationCreate";
import type { ShareableRole } from "../../sharing/collaborator-roles";

interface ExperimentInviteModalProps {
  experimentId: string;
  invitations: Invitation[];
  /** Grantees already on the experiment — not offered again by the picker. */
  existingGranteeIds?: string[];
  isArchived: boolean;
  /** `can(share)`: losing it mid-session takes the form away, not just the button. */
  canShare: boolean;
  /** Everyone can already read a public experiment, which changes what a tier buys. */
  isPublic?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Invite someone to an experiment: an existing account, a whole organization, or
 * an email address that has no account yet.
 *
 * The tier chosen here is the tier they end up with — immediately for a grant,
 * on acceptance for an emailed invitation. It defaults to "Can view", which on an
 * experiment is the contributing tier: reading plus adding measurements and
 * annotations. That is also why a public experiment gets a different hint —
 * viewing is already universal there, so "Can view" is bought for the
 * contribution it carries.
 */
export function ExperimentInviteModal({
  experimentId,
  invitations,
  existingGranteeIds,
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
      existingGranteeIds={existingGranteeIds}
      existingEmails={invitations.map((invitation) => invitation.email)}
      onEmailInvite={handleEmailInvite}
      isEmailInvitePending={isCreatingInvitation}
      hint={isPublic ? t("sharing.publicExperimentTierHint") : t("sharing.experimentTierHint")}
    />
  );
}
