"use client";

import { useAddOrganizationMember } from "@/hooks/organization/useAddOrganizationMember/useAddOrganizationMember";
import { useInviteOrganizationMember } from "@/hooks/organization/useInviteOrganizationMember/useInviteOrganizationMember";
import { useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";
import { parseApiError } from "~/util/apiError";

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
 * Search first, invite second — the same two outcomes the sharing dialog offers.
 *
 * Somebody with an account is added outright: there is a user to attach the
 * membership to, and waiting for them to accept an invitation to an organization
 * whose owner already decided they belong in it is ceremony. An address no account
 * answers to still gets Better Auth's email invitation, which is what that machinery
 * is for — and signing up with the invited address still joins them automatically.
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

  const { mutateAsync: invite, isPending: isInviting } = useInviteOrganizationMember();
  const { mutateAsync: addMember, isPending: isAdding } = useAddOrganizationMember();

  const isPending = isInviting || isAdding;

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
      if (selection.kind === "user") {
        await addMember({ id: organizationId, userId: selection.userId, role });
        toast({ description: t("organizations.invite.added", { name: selection.displayName }) });
      } else {
        await invite({ organizationId, email: selection.email, role });
        toast({ description: t("organizations.invite.sent", { email: selection.email }) });
      }
    } catch (err) {
      // Keep the dialog — and the picked person — so a refusal can be read and
      // retried without searching again. The two paths fail through different
      // clients, so each is unwrapped by its own reader.
      toast({
        description:
          selection.kind === "user"
            ? (parseApiError(err)?.message ?? t("organizations.invite.addFailed"))
            : (authErrorMessage(err) ?? t("organizations.invite.failed")),
        variant: "destructive",
      });
      return;
    }

    reset();
    onOpenChange(false);
  };

  const isEmailInvite = selection?.kind === "email";

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
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
            {t("common.cancel")}
          </Button>
          {/* Two outcomes, two labels: an invitation is sent and waited on, a
              registered person is simply added. */}
          <Button onClick={() => void submit()} disabled={isPending || !selection}>
            {isPending
              ? isEmailInvite
                ? t("organizations.invite.sending")
                : t("organizations.invite.adding")
              : isEmailInvite
                ? t("organizations.invite.submit")
                : t("organizations.invite.addSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
