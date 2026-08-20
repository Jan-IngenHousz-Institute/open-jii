"use client";

import { useInviteOrganizationMember } from "@/hooks/organization/useInviteOrganizationMember/useInviteOrganizationMember";
import { useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

import { organizationRoleLabelKey } from "./organization-labels";
import type { OrganizationInviteSelection } from "./organization-member-picker";
import { OrganizationMemberPicker } from "./organization-member-picker";

interface OrganizationInviteDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The roles this actor may hand out. Only owners may make an owner, so an admin's
   * dialog simply does not offer it.
   */
  invitableRoles: OrganizationRole[];
  /** Roster user ids — listed by the search, but not addable again. */
  memberUserIds: string[];
  /** Roster addresses, so a member the search cannot return is not invited either. */
  memberEmails: string[];
  /** Addresses with a live invitation. */
  pendingInvitationEmails: string[];
}

/**
 * Search for somebody, choose the role they would arrive on, invite them.
 *
 * One outcome, whoever the target is and whatever the role: **nobody joins an
 * organization they did not ask to join.** Somebody with an account is invited at their
 * own address rather than added, so the membership begins when they hold it — a
 * membership carries read access to everything the organization owns, and an admin or
 * owner role carries answerability for other people's work that an unasked-for
 * assignment cannot confer. An address no account answers to is the same invitation.
 *
 * Two things stay instant, and neither contradicts that: approving a join request,
 * where the person asked, and changing an existing member's role, where they already
 * accepted joining once.
 */
export function OrganizationInviteDialog({
  organizationId,
  open,
  onOpenChange,
  invitableRoles,
  memberUserIds,
  memberEmails,
  pendingInvitationEmails,
}: OrganizationInviteDialogProps) {
  const { t } = useTranslation();

  const [selection, setSelection] = useState<OrganizationInviteSelection | null>(null);
  const [role, setRole] = useState<OrganizationRole>("member");

  const { mutateAsync: invite, isPending } = useInviteOrganizationMember();

  const reset = () => {
    setSelection(null);
    setRole("member");
  };

  const handleOpenChange = (next: boolean) => {
    // Escape, the close button and an outside click all route here, so a request
    // in flight has to be refused here too, not only on Cancel.
    if (!next && isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    if (!selection) return;

    try {
      await invite({ organizationId, email: selection.email, role });
      toast({ description: t("organizations.invite.sent", { email: selection.email }) });
    } catch (err) {
      // Keep the dialog — and the picked person — so a refusal can be read and
      // retried without searching again.
      toast({
        description: authErrorMessage(err) ?? t("organizations.invite.failed"),
        variant: "destructive",
      });
      return;
    }

    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{t("organizations.invite.title")}</DialogTitle>
          <DialogDescription>{t("organizations.invite.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <OrganizationMemberPicker
            selection={selection}
            onSelectionChange={setSelection}
            memberUserIds={memberUserIds}
            memberEmails={memberEmails}
            pendingInvitationEmails={pendingInvitationEmails}
            disabled={isPending}
          />

          <div className="space-y-1.5">
            <Label htmlFor="organization-invite-role">{t("organizations.invite.roleLabel")}</Label>
            <Select
              value={role}
              onValueChange={(next) => setRole(next as OrganizationRole)}
              disabled={isPending}
            >
              <SelectTrigger id="organization-invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {invitableRoles.map((invitable) => (
                  <SelectItem key={invitable} value={invitable}>
                    {t(organizationRoleLabelKey(invitable))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">{t(`organizations.roleHints.${role}`)}</p>
            {/* What the button is about to do, before it is pressed. Said for a picked
                account rather than for a typed address, where "an invitation is sent" is
                already the obvious reading of the affordance. */}
            {selection?.kind === "user" && (
              <p className="text-muted-foreground text-xs">
                {t("organizations.invite.mustAccept", {
                  name: selection.displayName,
                  role: t(organizationRoleLabelKey(role)),
                })}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={isPending || !selection}>
            {isPending ? t("organizations.invite.sending") : t("organizations.invite.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
