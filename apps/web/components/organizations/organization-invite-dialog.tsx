"use client";

import { useInviteOrganizationMember } from "@/hooks/organization/useInviteOrganizationMember/useInviteOrganizationMember";
import { useState } from "react";
import { z } from "zod";
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
import { Input } from "@repo/ui/components/input";
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

const emailSchema = z.string().email();

interface OrganizationInviteDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The roles this actor may hand out. Only owners may invite an owner, so an
   * admin's dialog simply does not offer it.
   */
  invitableRoles: OrganizationRole[];
  /** Addresses already invited or already members — refused before a round trip. */
  existingEmails: string[];
}

/**
 * Invite by email address. Unlike resource sharing there is no user search here:
 * an organization invitation is addressed to an email, and whether an account
 * exists behind it is Better Auth's business — a new account that signs up with
 * the invited address has the invitation accepted for it automatically.
 */
export function OrganizationInviteDialog({
  organizationId,
  open,
  onOpenChange,
  invitableRoles,
  existingEmails,
}: OrganizationInviteDialogProps) {
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>("member");

  const { mutateAsync: invite, isPending } = useInviteOrganizationMember(organizationId);

  const trimmedEmail = email.trim();
  const isEmailValid = emailSchema.safeParse(trimmedEmail).success;
  const isAlreadyPresent = existingEmails.some(
    (existing) => existing.toLowerCase() === trimmedEmail.toLowerCase(),
  );

  const reset = () => {
    setEmail("");
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
    if (!isEmailValid || isAlreadyPresent) return;
    try {
      await invite({ email: trimmedEmail, role });
      toast({ description: t("organizations.invite.sent", { email: trimmedEmail }) });
      reset();
      onOpenChange(false);
    } catch (err) {
      // Keep the dialog and the typed address so a refusal can be read and fixed.
      toast({
        description: authErrorMessage(err) ?? t("organizations.invite.failed"),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{t("organizations.invite.title")}</DialogTitle>
          <DialogDescription>{t("organizations.invite.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="organization-invite-email">
              {t("organizations.invite.emailLabel")}
            </Label>
            <Input
              id="organization-invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("organizations.invite.emailPlaceholder")}
              disabled={isPending}
              aria-invalid={trimmedEmail.length > 0 && (!isEmailValid || isAlreadyPresent)}
            />
            {trimmedEmail.length > 0 && !isEmailValid ? (
              <p className="text-destructive text-xs">{t("organizations.invite.invalidEmail")}</p>
            ) : isAlreadyPresent ? (
              <p className="text-destructive text-xs">{t("organizations.invite.alreadyPresent")}</p>
            ) : null}
          </div>

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
          <Button
            onClick={() => void submit()}
            disabled={isPending || !isEmailValid || isAlreadyPresent}
          >
            {isPending ? t("organizations.invite.sending") : t("organizations.invite.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
