"use client";

import { useCollaboratorAdd } from "@/hooks/sharing/useCollaboratorAdd/useCollaboratorAdd";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import { zCreateCollaboratorBody } from "@repo/api/domains/sharing/sharing.schema";
import type { ShareableRole, SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
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
import { toast } from "@repo/ui/hooks/use-toast";

import { roleRaisesAccess } from "./collaborator-roles";
import type { GranteeSelection } from "./grantee-picker";
import { GranteePicker } from "./grantee-picker";
import { RoleSelect } from "./role-select";

/** The tier the create endpoint applies when the field is omitted. */
const DEFAULT_ROLE: ShareableRole = zCreateCollaboratorBody.shape.role.parse(undefined);

interface CollaboratorInviteDialogProps {
  resourceType: SharingResourceType;
  resourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Archived or otherwise frozen resource: the form stays inert. */
  disabled?: boolean;
  /** Grantee ids already on the resource — not offered again. */
  existingGranteeIds?: string[];
  /** Addresses with a pending invitation — not offered again either. */
  existingEmails?: string[];
  /** Omit when the host has nowhere to persist a pending email invitation. */
  onEmailInvite?: (email: string, tier: ShareableRole) => Promise<void>;
  isEmailInvitePending?: boolean;
  /** What the chosen tier means here — e.g. contribution on a public experiment. */
  hint?: React.ReactNode;
}

export function CollaboratorInviteDialog({
  resourceType,
  resourceId,
  open,
  onOpenChange,
  title,
  description,
  disabled = false,
  existingGranteeIds = [],
  existingEmails = [],
  onEmailInvite,
  isEmailInvitePending = false,
  hint,
}: CollaboratorInviteDialogProps) {
  const { t } = useTranslation();

  const [selection, setSelection] = useState<GranteeSelection | null>(null);
  const [role, setRole] = useState<ShareableRole>(DEFAULT_ROLE);

  const { mutateAsync: addCollaborator, isPending: isSharing } = useCollaboratorAdd();

  const isSubmitting = isSharing || isEmailInvitePending;
  const controlsDisabled = disabled || isSubmitting;

  // The tier can be changed after the grantee was picked, so what the picker ruled
  // selectable at the time says nothing about what is about to be submitted.
  const access = selection?.kind === "grantee" ? selection.grantee.access : undefined;
  const isInertShare = !!access && !roleRaisesAccess(access, role, resourceType);

  const reset = () => {
    setSelection(null);
    setRole(DEFAULT_ROLE);
  };

  const handleOpenChange = (next: boolean) => {
    // Escape, the close button and an outside click all route here, so a submission
    // in flight has to be refused here too — not just on the Cancel button. Letting
    // the dialog close mid-request would let it be reopened with a fresh grantee,
    // which the finishing request would then reset and close out from under.
    if (!next && isSubmitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!selection || disabled || isInertShare) return;

    try {
      if (selection.kind === "grantee") {
        await addCollaborator({
          resourceType,
          id: resourceId,
          granteeType: selection.grantee.type,
          granteeId: selection.grantee.id,
          role,
        });
        toast({
          description: t("sharing.collaboratorAdded", { name: selection.grantee.displayName }),
        });
      } else {
        // Reported by the host, which owns the invitation wording.
        await onEmailInvite?.(selection.email, role);
      }
    } catch (err) {
      // Keep the dialog — and the picked grantee — so a refusal can be read and
      // retried without searching again.
      toast({
        description: parseApiError(err)?.message ?? t("sharing.shareFailed"),
        variant: "destructive",
      });
      return;
    }

    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <GranteePicker
            resourceType={resourceType}
            resourceId={resourceId}
            role={role}
            selection={selection}
            onSelectionChange={setSelection}
            allowEmailInvite={!!onEmailInvite}
            existingGranteeIds={existingGranteeIds}
            existingEmails={existingEmails}
            disabled={controlsDisabled}
          />

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{t("sharing.accessLevel")}</span>
            <RoleSelect
              value={role}
              onChange={setRole}
              disabled={controlsDisabled}
              ariaLabel={t("sharing.newShareRoleLabel")}
            />
          </div>

          {isInertShare && (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("sharing.granteeTierAddsNothing")}
            </p>
          )}

          {hint ? <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={controlsDisabled || !selection || isInertShare}
          >
            {isSubmitting ? t("sharing.sharing") : t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
