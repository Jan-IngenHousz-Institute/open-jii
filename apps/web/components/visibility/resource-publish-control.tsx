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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { toast } from "@repo/ui/hooks/use-toast";

/** Resource types that have a publish surface. Devices are out of scope. */
export type PublishableResourceType = "macro" | "protocol" | "workbook";

/**
 * Where the explanatory copy goes. `block` is the experiment card's treatment —
 * a tinted box under the select. `tooltip` puts it on an info icon beside the
 * heading, for a host too narrow to give it a line.
 */
export type PublishControlInfoPlacement = "block" | "tooltip";

interface ResourcePublishControlProps {
  resourceType: PublishableResourceType;
  resourceId: string;
  visibility: Visibility;
  /** `can(manage)` from the detail response — publishing is manage-gated. */
  canManage: boolean;
  infoPlacement?: PublishControlInfoPlacement;
}

/**
 * Visibility select for macros / protocols / workbooks — the same control the
 * experiment settings card has, so all four types are set the same way.
 *
 * The backend had monotonic `setVisibility` routes for all three types and they were
 * creatable as private, but the only publish control in the app was the experiment
 * card — so a private macro/protocol/workbook could never be published from the UI
 * and the private → share → publish lifecycle could not be completed. This is the
 * missing control. Choosing "Public" is confirmed before it is written, and the
 * select goes inert once public, because visibility never goes back.
 *
 * The explanatory copy defaults to the experiment card's block, which is what the
 * details sidebars want: they stack full-width rows, so a couple of wrapped lines
 * cost nothing. A host laying its fields out horizontally has no room for that —
 * a block there wraps and breaks the row — so it asks for `tooltip` instead.
 *
 * Gated on `canManage` rather than on `createdBy`, so an admin grantee can
 * publish and a viewer cannot — the same decision the backend route enforces.
 */
export function ResourcePublishControl({
  resourceType,
  resourceId,
  visibility,
  canManage,
  infoPlacement = "block",
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

  const helpText = isPublic
    ? t("resourceVisibility.publishedDescription")
    : t("resourceVisibility.privateDescription");

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
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <h4 className="text-sm font-medium">{t("resourceVisibility.statusLabel")}</h4>
        {infoPlacement === "tooltip" && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* The copy is the icon's accessible name too, so it is readable
                    without hovering. */}
                <button type="button" className="text-muted-foreground" aria-label={helpText}>
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs leading-snug">
                {helpText}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <Select
        value={isPublic ? "public" : "private"}
        // Only private → public is reachable, and it is irreversible, so the
        // choice opens the confirmation instead of writing.
        onValueChange={(value) => {
          if (value === "public") setShowConfirm(true);
        }}
        disabled={!canManage || isPublic}
      >
        <SelectTrigger className="w-full" aria-label={t("resourceVisibility.statusLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="private">{t("resourceVisibility.privateStatus")}</SelectItem>
          <SelectItem value="public">{t("resourceVisibility.publicStatus")}</SelectItem>
        </SelectContent>
      </Select>

      {infoPlacement === "block" && (
        // The experiment card's box, verbatim, so the two surfaces read alike.
        // `mt-2` because the heading→select gap here is the sidebar's tighter
        // `space-y-1`, and the copy still wants the card's breathing room.
        <div className="bg-surface-light text-muted-foreground mt-2 flex items-center gap-2 rounded-md p-2 text-xs">
          <Info className="text-primary h-4 w-4 shrink-0" />
          <div className="leading-tight">{helpText}</div>
        </div>
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
