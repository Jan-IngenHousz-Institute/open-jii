"use client";

import { useMacroDelete } from "@/hooks/macro/useMacroDelete/useMacroDelete";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";
import React from "react";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/components";

interface MacroInfoCardProps {
  macroId: string;
  macro: Macro;
}

export function MacroInfoCard({ macroId, macro }: MacroInfoCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const { mutateAsync: deleteMacro, isPending } = useMacroDelete();

  const { t } = useTranslation("macro");
  const locale = useLocale();
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION);

  const handleDeleteMacro = async () => {
    await deleteMacro({ params: { id: macroId } });
    setIsDeleteDialogOpen(false);
    // Navigate to macros list
    router.push(`/${locale}/platform/macros`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("macroSettings.macroInfo")}</CardTitle>
        <CardDescription>{t("macroSettings.macroInfoDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">{t("macroSettings.created")}:</span>{" "}
            {formatDate(macro.createdAt)}
          </div>
          <div>
            <span className="font-medium">{t("macroSettings.updated")}:</span>{" "}
            {formatDate(macro.updatedAt)}
          </div>
          <div>
            <span className="font-medium">{t("macros.macroId")}:</span>{" "}
            <span className="font-mono text-xs">{macro.id}</span>
          </div>
        </div>

        {isDeletionEnabled && (
          <div className="border-t pt-4">
            <h5 className="text-destructive mb-2 text-base font-medium">
              {t("macroSettings.dangerZone")}
            </h5>
            <p className="text-muted-foreground mb-4 text-sm">{t("macroSettings.deleteWarning")}</p>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">{t("macroSettings.deleteMacro")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-destructive">
                    {t("macroSettings.deleteMacro")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("macroSettings.confirmDelete")} "{macro.name}"?{" "}
                    {t("macroSettings.deleteWarning")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    {t("macroSettings.cancel")}
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteMacro} disabled={isPending}>
                    {isPending ? t("macroSettings.deleting") : t("macroSettings.delete")}
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
