"use client";

import { useMyOrganizations } from "@/hooks/organization/useMyOrganizations/useMyOrganizations";
import { useTransferResourceOrganization } from "@/hooks/sharing/useTransferResourceOrganization/useTransferResourceOrganization";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { TransferableResourceType } from "@repo/api/domains/sharing/transfer-org/sharing-transfer-org.schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

interface ResourceTransferDialogProps {
  resourceType: TransferableResourceType;
  resourceId: string;
  /** The organization that owns it today, excluded from the target list. */
  currentOrganizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Move a resource to another organization the caller belongs to. Their personal
 * workspace qualifies — it is the way out for a resource stranded in an
 * organization whose owners are all gone.
 *
 * Team grants of the source organization are dropped by the transfer: a team
 * cannot hold access outside the organization it belongs to. User and organization
 * grants, visibility and data all survive, which is what the confirmation says.
 *
 * The flow only; its trigger belongs to whatever displays the owning organization,
 * so that value is both the answer and the way to change it.
 */
export function ResourceTransferDialog({
  resourceType,
  resourceId,
  currentOrganizationId,
  open,
  onOpenChange,
}: ResourceTransferDialogProps) {
  const { t } = useTranslation();

  const [targetOrganizationId, setTargetOrganizationId] = useState("");

  // Only asked for once the flow is reachable, which is what the caller's gating
  // decides — a viewer who cannot transfer never opens this.
  const { data: organizations } = useMyOrganizations({ enabled: open });
  const { mutateAsync: transfer, isPending } = useTransferResourceOrganization();

  // Transferring to the current owner is a no-op the server rejects, so it is not
  // offered; a personal workspace is a legitimate target and is labelled as one.
  const targets = (organizations ?? []).filter(
    (organization) => organization.id !== currentOrganizationId,
  );

  const close = (next: boolean) => {
    // Escape, the close button and an outside click all route here, so a request in
    // flight has to be refused here too, not only on Cancel.
    if (!next && isPending) return;
    if (!next) setTargetOrganizationId("");
    onOpenChange(next);
  };

  const submit = async () => {
    if (targetOrganizationId === "") return;
    try {
      await transfer({ resourceType, id: resourceId, targetOrganizationId });
      toast({ description: t("organizations.transfer.transferred") });
      setTargetOrganizationId("");
      onOpenChange(false);
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? t("organizations.transfer.failed"),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{t("organizations.transfer.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("organizations.transfer.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Select
            value={targetOrganizationId}
            onValueChange={setTargetOrganizationId}
            disabled={isPending || targets.length === 0}
          >
            <SelectTrigger aria-label={t("organizations.transfer.targetLabel")}>
              <SelectValue
                placeholder={
                  targets.length === 0
                    ? t("organizations.transfer.noTargets")
                    : t("organizations.transfer.targetPlaceholder")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {targets.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.isPersonal ? t("organizations.picker.personal") : organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("organizations.transfer.note")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={isPending || targetOrganizationId === ""}>
            {isPending
              ? t("organizations.transfer.transferring")
              : t("organizations.transfer.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
