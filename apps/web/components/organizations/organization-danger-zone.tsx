"use client";

import { useDeleteOrganization } from "@/hooks/organization/useDeleteOrganization/useDeleteOrganization";
import { useOrganizationDeletionBlockers } from "@/hooks/organization/useOrganizationDeletionBlockers/useOrganizationDeletionBlockers";
import { useLocale } from "@/hooks/useLocale";
import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorMessage } from "~/hooks/organization/auth-organization-result";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationConfirmDialog } from "./organization-confirm-dialog";
import { organizationsPath } from "./organization-routes";

/**
 * Deleting an organization. Nothing cascades: the server refuses while the
 * organization still owns any resource, so the resources have to be transferred
 * elsewhere or deleted first — a deliberate divergence from platforms that
 * vaporize published work behind one confirmation.
 *
 * The button is disabled with the reason spelled out rather than hidden, because
 * the block is a temporary state with a clear remedy: the owner needs to know why
 * they cannot delete and what would let them.
 *
 * The count comes from the dedicated blocker read, not from the resources showcase.
 * The showcase is scoped to what the caller may read and carries only the four
 * shareable types, while the delete guard counts all five — so an organization
 * owning nothing but a device would read as deletable there and be refused only
 * after the confirmation. A raced server refusal is still surfaced verbatim.
 */
export function OrganizationDangerZone({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = useLocale();

  const { data: blockers, isPending: isCountPending } =
    useOrganizationDeletionBlockers(organizationId);
  const { mutateAsync: deleteOrganization, isPending: isDeleting } = useDeleteOrganization();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const resourceCount = blockers?.total ?? 0;
  const isBlocked = resourceCount > 0;

  const confirmDeletion = async () => {
    try {
      await deleteOrganization({ organizationId });
      toast({ description: t("organizations.delete.deleted", { name: organizationName }) });
      setIsConfirmOpen(false);
      router.push(organizationsPath(locale));
    } catch (err) {
      toast({
        description: authErrorMessage(err) ?? t("organizations.delete.failed"),
        variant: "destructive",
      });
    }
  };

  // The breakdown names each type in the caller's language, so "transfer or delete
  // them first" points somewhere specific — a device in particular has no page in
  // the showcase to have been noticed on.
  const breakdown = (blockers?.blockers ?? []).map(
    ({ resourceType, count }) =>
      `${count} ${t(`organizations.delete.owned.${resourceType}`, { count })}`,
  );
  const blockedReason = t("organizations.delete.blockedReason", {
    count: resourceCount,
    breakdown: breakdown.join(", "),
  });

  return (
    <section className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-lg border p-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <TriangleAlert className="text-destructive h-3.5 w-3.5 shrink-0" aria-hidden />
          <h3 className="text-destructive text-sm font-semibold">
            {t("organizations.delete.action")}
          </h3>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("organizations.delete.description")}
        </p>
      </div>

      {/* One chip per type still held, rather than the same list buried in a
          sentence: the remedy is per type, so the list is the instruction. */}
      {isBlocked ? (
        <div className="bg-card rounded-md border p-3">
          <span className="text-muted-foreground mb-2 block text-[11px] font-semibold uppercase tracking-wider">
            {t("organizations.delete.stillOwned")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {breakdown.map((entry) => (
              <Badge key={entry} variant="outline" className="bg-card font-normal">
                {entry}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col items-start gap-2">
        <Button
          variant="destructive"
          onClick={() => setIsConfirmOpen(true)}
          // Unresolved is not "unblocked": until the count answers, offering the
          // action would invite a click the server is about to refuse.
          disabled={isBlocked || isCountPending || isDeleting}
          title={isBlocked ? blockedReason : undefined}
          aria-describedby={isBlocked ? "organization-delete-blocked" : undefined}
        >
          {t("organizations.delete.action")}
        </Button>
        {isBlocked ? (
          <p id="organization-delete-blocked" className="text-muted-foreground text-xs">
            {blockedReason}
          </p>
        ) : null}
      </div>

      <OrganizationConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={t("organizations.delete.confirmTitle")}
        description={t("organizations.delete.confirmDescription", { name: organizationName })}
        note={t("organizations.delete.confirmNote")}
        confirmLabel={t("organizations.delete.action")}
        pendingLabel={t("organizations.delete.deleting")}
        isPending={isDeleting}
        onConfirm={() => void confirmDeletion()}
      />
    </section>
  );
}
