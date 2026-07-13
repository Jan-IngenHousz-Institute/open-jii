"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Command } from "@repo/api/schemas/command.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/components/dialog";

import { useCommandDelete } from "../../hooks/command/useCommandDelete/useCommandDelete";

interface CommandInfoCardProps {
  commandId: string;
  command: Command;
}

export function CommandInfoCard({ commandId, command }: CommandInfoCardProps) {
  const { mutateAsync: deleteCommand, isPending: isDeleting } = useCommandDelete(commandId);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.COMMAND_DELETION);

  const handleDeleteCommand = async () => {
    await deleteCommand({ params: { id: commandId } });
    setIsDeleteDialogOpen(false);
    // Navigate to commands list
    router.push(`/${locale}/platform/commands`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("commandSettings.commandInfo")}</CardTitle>
        <CardDescription>{t("commandSettings.commandInfoDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">{t("commandSettings.created")}:</span>{" "}
            {formatDate(command.createdAt)}
          </div>
          <div>
            <span className="font-medium">{t("commandSettings.updated")}:</span>{" "}
            {formatDate(command.updatedAt)}
          </div>
          <div>
            <span className="font-medium">{t("commands.commandId")}:</span>{" "}
            <span className="font-mono text-xs">{command.id}</span>
          </div>
        </div>

        {isDeletionEnabled && (
          <div className="border-t pt-4">
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
                    {t("common.confirmDelete", { name: command.name })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    {t("commandSettings.cancel")}
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteCommand} disabled={isDeleting}>
                    {isDeleting ? t("commandSettings.deleting") : t("commandSettings.delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
