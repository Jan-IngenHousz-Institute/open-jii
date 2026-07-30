"use client";

import { useResourceLeave } from "@/hooks/sharing/useResourceLeave/useResourceLeave";
import { useLocale } from "@/hooks/useLocale";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { RESOURCE_ROUTE_SEGMENTS } from "./resource-routes";
import { RevokeCollaboratorDialog } from "./revoke-collaborator-dialog";

interface LeaveResourceCardProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /** Blocks leaving (e.g. an archived experiment), matching the rest of the surface. */
  disabled?: boolean;
}

/**
 * The self-leave affordance for grantees below `share` (`capabilities.canLeave`
 * without `canShare`). They cannot see the collaborators list — it is
 * deliberately share-gated — so they have no row of their own to act on;
 * this card is the surface they get instead.
 *
 * Share-capable users don't need it (their own row's revoke is "leave"), so
 * hosts render this only for `canLeave && !canShare`.
 *
 * On success the user is sent back to the resource list: their access may be
 * gone entirely, and the hook has already dropped the resource's own caches so
 * nothing stale is left behind.
 */
export function LeaveResourceCard({
  resourceType,
  resourceId,
  disabled = false,
}: LeaveResourceCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = useLocale();
  const { mutateAsync: leave, isPending } = useResourceLeave();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const confirmLeave = async () => {
    if (disabled) return;
    try {
      await leave({ resourceType, id: resourceId });
      setIsConfirmOpen(false);
      toast({ description: t("sharing.leftResource") });
      router.push(`/${locale}/platform/${RESOURCE_ROUTE_SEGMENTS[resourceType]}`);
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? t("sharing.leaveFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="border-border flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-foreground text-sm font-semibold">{t("sharing.yourAccessTitle")}</p>
        <p className="text-muted-foreground text-sm">{t("sharing.yourAccessDescription")}</p>
      </div>
      <Button variant="outline" onClick={() => setIsConfirmOpen(true)} disabled={disabled}>
        <LogOut className="h-4 w-4" />
        {t("sharing.leaveAction")}
      </Button>

      <RevokeCollaboratorDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        granteeName=""
        isSelf
        isRevoking={isPending}
        confirmDisabled={disabled}
        onConfirm={() => void confirmLeave()}
      />
    </div>
  );
}
