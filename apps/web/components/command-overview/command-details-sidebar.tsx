"use client";

import { useCommandUpdate } from "@/hooks/command/useCommandUpdate/useCommandUpdate";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";
import { getSensorFamilyLabel, SENSOR_FAMILY_OPTIONS } from "~/util/sensor-family";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Command, SensorFamily } from "@repo/api/schemas/command.schema";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

import { useCommandCompatibleMacros } from "../../hooks/command/useCommandCompatibleMacros/useCommandCompatibleMacros";
import { useCommandDelete } from "../../hooks/command/useCommandDelete/useCommandDelete";
import { CommandCompatibleMacrosCard } from "../command-settings/command-compatible-macros-card";
import { DetailsSidebarCard } from "../shared/details-sidebar-card";

interface CommandDetailsSidebarProps {
  commandId: string;
  command: Command;
}

export function CommandDetailsSidebar({ commandId, command }: CommandDetailsSidebarProps) {
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const locale = useLocale();
  const router = useRouter();

  const isCreator = session?.user.id === command.createdBy;
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.COMMAND_DELETION);

  const { mutateAsync: updateCommand, isPending: isUpdating } = useCommandUpdate(commandId);
  const { mutateAsync: deleteCommand, isPending: isDeleting } = useCommandDelete(commandId);
  const { data: compatibleMacrosData } = useCommandCompatibleMacros(commandId);
  const compatibleMacrosCount = compatibleMacrosData?.body.length ?? 0;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleFamilyChange = async (newFamily: string) => {
    await updateCommand(
      {
        params: { id: commandId },
        body: { family: newFamily as SensorFamily },
      },
      {
        onSuccess: () => {
          toast({ description: t("commands.commandUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = async () => {
    await deleteCommand({ params: { id: commandId } });
    setIsDeleteDialogOpen(false);
    router.push(`/${locale}/platform/commands`);
  };

  return (
    <DetailsSidebarCard
      title={t("commands.detailsTitle")}
      collapsedSummary={`${tCommon("common.updated")} ${formatDate(command.updatedAt)}, ${t("commands.commandId")} ${command.id.slice(0, 8)}...`}
    >
      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("commands.commandId")}</h4>
        <p className="text-muted-foreground font-mono text-sm">{command.id}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("commands.family")}</h4>
        {isCreator ? (
          <Select value={command.family} onValueChange={handleFamilyChange} disabled={isUpdating}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SENSOR_FAMILY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-muted-foreground text-sm capitalize">
            {getSensorFamilyLabel(command.family)}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.updated")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(command.updatedAt)}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.created")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(command.createdAt)}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("experiments.createdBy")}</h4>
        <p className="text-muted-foreground text-sm">{command.createdByName ?? "-"}</p>
      </div>

      {command.forkedFrom ? (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">{tCommon("common.forkedFrom")}</h4>
          <Link
            href={`/${locale}/platform/commands/${command.forkedFrom}`}
            className="text-sm text-[#005E5E] underline underline-offset-2 hover:text-[#004848]"
          >
            {tCommon("common.viewOriginal")}
          </Link>
        </div>
      ) : null}

      {/* Compatible Macros Section */}
      <div
        role="separator"
        aria-orientation="horizontal"
        className="text-muted-foreground border-t"
      />

      {isCreator ? (
        <CommandCompatibleMacrosCard commandId={commandId} embedded />
      ) : (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">{t("commandSettings.compatibleMacros")}</h4>
          <p className="text-muted-foreground text-sm">
            {compatibleMacrosCount > 0
              ? `${compatibleMacrosCount} ${compatibleMacrosCount === 1 ? "macro" : "macros"}`
              : t("commandSettings.noCompatibleMacros")}
          </p>
        </div>
      )}

      {/* Danger Zone */}
      {isCreator && isDeletionEnabled && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            className="text-muted-foreground border-t"
          />
          <div>
            <h5 className="text-destructive mb-2 text-base font-medium">
              {t("commandSettings.dangerZone")}
            </h5>
            <p className="text-muted-foreground mb-4 text-sm">
              {t("commandSettings.deleteWarning")}
            </p>
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">{t("commandSettings.deleteCommand")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-destructive">
                    {t("commandSettings.deleteCommand")}
                  </DialogTitle>
                  <DialogDescription>
                    {tCommon("common.confirmDelete", { name: command.name })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    {t("commandSettings.cancel")}
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? t("commandSettings.deleting") : t("commandSettings.delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </>
      )}
    </DetailsSidebarCard>
  );
}
