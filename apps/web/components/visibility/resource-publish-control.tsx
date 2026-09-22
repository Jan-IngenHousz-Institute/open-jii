"use client";

import { PublishConfirmDialog } from "@/components/visibility/publish-confirm-dialog";
import { useSetCalibrationDefinitionVisibility } from "@/hooks/iot/useSetCalibrationDefinitionVisibility/useSetCalibrationDefinitionVisibility";
import { useSetMacroVisibility } from "@/hooks/macro/useSetMacroVisibility/useSetMacroVisibility";
import { useSetProtocolVisibility } from "@/hooks/protocol/useSetProtocolVisibility/useSetProtocolVisibility";
import { useSetWorkbookVisibility } from "@/hooks/workbook/useSetWorkbookVisibility/useSetWorkbookVisibility";
import { Info } from "lucide-react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import type {
  PublishableResourceType,
  Visibility,
} from "@repo/api/domains/visibility/visibility.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
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

/**
 * Experiments have their own settings card; deriving the type from the publishable set
 * keeps a new publishable resource a compile error here.
 */
type PublishSelectResourceType = Exclude<PublishableResourceType, "experiment">;

/** Narrow horizontal hosts use a tooltip; full-width hosts keep the copy visible. */
type PublishControlInfoPlacement = "block" | "tooltip";

interface ResourcePublishControlProps {
  resourceType: PublishSelectResourceType;
  resourceId: string;
  visibility: Visibility;
  /** `can(manage)` from the detail response — publishing is manage-gated. */
  canManage: boolean;
  infoPlacement?: PublishControlInfoPlacement;
}

/**
 * Completes the private → share → publish flow for non-experiment resources.
 * Publishing is irreversible, so it requires confirmation and becomes inert once
 * public; `canManage` mirrors the backend gate instead of relying on ownership.
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
  const setCalibrationDefinitionVisibility = useSetCalibrationDefinitionVisibility();

  const isPending =
    setMacroVisibility.isPending ||
    setProtocolVisibility.isPending ||
    setWorkbookVisibility.isPending ||
    setCalibrationDefinitionVisibility.isPending;

  // Publishing, per type: the routes agree on everything but what they call the id, and
  // the exhaustive record makes a newly publishable type a compile error here.
  const publish: Record<PublishSelectResourceType, (id: string) => Promise<unknown>> = {
    macro: (id) => setMacroVisibility.mutateAsync({ id, visibility: "public" }),
    protocol: (id) => setProtocolVisibility.mutateAsync({ id, visibility: "public" }),
    workbook: (id) => setWorkbookVisibility.mutateAsync({ id, visibility: "public" }),
    calibration_definition: (id) =>
      setCalibrationDefinitionVisibility.mutateAsync({ definitionId: id, visibility: "public" }),
  };

  // Visibility is monotonic, so optimistic local publication cannot go stale.
  const [publishedLocally, setPublishedLocally] = useState(false);
  const isPublic = visibility === "public" || publishedLocally;

  const helpText = isPublic
    ? t("resourceVisibility.publishedDescription")
    : t("resourceVisibility.privateDescription");

  const confirmPublish = async () => {
    try {
      await publish[resourceType](resourceId);
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
                {/* Keep the help copy available without hover. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label={helpText}
                >
                  <Info className="h-3.5 w-3.5" />
                </Button>
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
        // Publishing is irreversible, so selecting it opens confirmation.
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
        <div className="bg-muted text-muted-foreground mt-2 flex items-center gap-2 rounded-md p-2 text-xs">
          <Info className="text-primary h-4 w-4 shrink-0" />
          <div className="leading-tight">{helpText}</div>
        </div>
      )}

      <PublishConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={() => void confirmPublish()}
        isPending={isPending}
      />
    </div>
  );
}
