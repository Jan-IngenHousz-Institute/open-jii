"use client";

import { useSetMacroVisibility } from "@/hooks/macro/useSetMacroVisibility/useSetMacroVisibility";
import { useSetProtocolVisibility } from "@/hooks/protocol/useSetProtocolVisibility/useSetProtocolVisibility";
import { useSetWorkbookVisibility } from "@/hooks/workbook/useSetWorkbookVisibility/useSetWorkbookVisibility";
import { Info } from "lucide-react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { Visibility } from "@repo/api/domains/visibility/visibility.schema";
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

import { VisibilityBadge } from "./visibility-badge";

/** Resource types that have a publish surface. Devices are out of scope. */
export type PublishableResourceType = "macro" | "protocol" | "workbook";

interface ResourcePublishControlProps {
  resourceType: PublishableResourceType;
  resourceId: string;
  visibility: Visibility;
  /** `can(manage)` from the detail response — publishing is manage-gated. */
  canManage: boolean;
}

/**
 * Visibility state plus the one-way publish action, for macros / protocols /
 * workbooks.
 *
 * The backend had monotonic `setVisibility` routes for all three types and they were
 * creatable as private, but the only publish control in the app was the experiment
 * card — so a private macro/protocol/workbook could never be published from the UI
 * and the private → share → publish lifecycle could not be completed. This is the
 * missing control, following the same shape as the
 * experiment card: while private, an explicit confirm-gated "Publish"; once
 * public, a static state with no controls, because visibility never goes back.
 *
 * Gated on `canManage` rather than on `createdBy`, so an admin grantee can
 * publish and a viewer cannot — the same decision the backend route enforces.
 */
export function ResourcePublishControl({
  resourceType,
  resourceId,
  visibility,
  canManage,
}: ResourcePublishControlProps) {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);

  const setMacroVisibility = useSetMacroVisibility();
  const setProtocolVisibility = useSetProtocolVisibility();
  const setWorkbookVisibility = useSetWorkbookVisibility();

  const mutation =
    resourceType === "macro"
      ? setMacroVisibility
      : resourceType === "protocol"
        ? setProtocolVisibility
        : setWorkbookVisibility;

  // Show the published state immediately on confirm, before the refetch lands.
  // Visibility is monotonic, so OR-ing with the prop is safe: if it is published
  // elsewhere the prop wins, and nothing can move it back to private.
  const [publishedLocally, setPublishedLocally] = useState(false);
  const isPublic = visibility === "public" || publishedLocally;

  const confirmPublish = async () => {
    try {
      await mutation.mutateAsync({ id: resourceId, visibility: "public" });
      setPublishedLocally(true);
      setShowConfirm(false);
      toast({ description: t("resourceVisibility.publishedToast") });
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? t("resourceVisibility.publishFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{t("resourceVisibility.statusLabel")}</h4>
      <VisibilityBadge visibility={isPublic ? "public" : "private"} />

      {isPublic ? (
        <div className="bg-surface-light text-muted-foreground flex items-start gap-2 rounded-md p-2 text-xs">
          <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="leading-tight">{t("resourceVisibility.publishedDescription")}</p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-xs leading-snug">
            {t("resourceVisibility.privateDescription")}
          </p>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={mutation.isPending}
            >
              {t("resourceVisibility.publishAction")}
            </Button>
          )}
        </>
      )}

      {/* Irreversible: private → public only, enforced server-side. */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resourceVisibility.publishConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("resourceVisibility.publishConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={mutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void confirmPublish()} disabled={mutation.isPending}>
              {mutation.isPending
                ? t("resourceVisibility.publishing")
                : t("resourceVisibility.publishConfirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
