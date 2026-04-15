"use client";

import { useMacroDelete } from "@/hooks/macro/useMacroDelete/useMacroDelete";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Macro, MacroLanguage } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@repo/ui/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

import { useMacroCompatibleProtocols } from "../../hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols";
import { MacroCompatibleProtocolsCard } from "../macro-settings/macro-compatible-protocols-card";
import { DetailsSidebarCard } from "../shared/details-sidebar-card";

interface MacroDetailsSidebarProps {
  macroId: string;
  macro: Macro;
}

export function MacroDetailsSidebar({ macroId, macro }: MacroDetailsSidebarProps) {
  const { t } = useTranslation(["macro", "common"]);
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const locale = useLocale();
  const router = useRouter();

  const isCreator = session?.user.id === macro.createdBy;
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION);

  const { mutateAsync: updateMacro, isPending: isUpdating } = useMacroUpdate(macroId);
  const { mutateAsync: deleteMacro, isPending: isDeleting } = useMacroDelete();
  const { data: compatibleProtocolsData } = useMacroCompatibleProtocols(macroId);
  const compatibleProtocolsCount =
    (compatibleProtocolsData?.body as unknown[] | undefined)?.length ?? 0;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleLanguageChange = async (newLanguage: string) => {
    await updateMacro(
      {
        params: { id: macroId },
        body: { language: newLanguage as MacroLanguage },
      },
      {
        onSuccess: () => {
          toast({ description: t("macros.macroUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = async () => {
    await deleteMacro({ params: { id: macroId } });
    setIsDeleteDialogOpen(false);
    router.push(`/${locale}/platform/macros`);
  };

  return (
    <DetailsSidebarCard
      title={t("macros.detailsTitle")}
      collapsedSummary={`${tCommon("common.updated")} ${formatDate(macro.updatedAt)}, ${t("macros.macroId")} ${macro.id.slice(0, 8)}...`}
    >
      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("macros.macroId")}</h4>
        <p className="text-muted-foreground font-mono text-sm">{macro.id}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("macros.language")}</h4>
        {isCreator ? (
          <Select value={macro.language} onValueChange={handleLanguageChange} disabled={isUpdating}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="r">R</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <p className="text-muted-foreground text-sm capitalize">{macro.language}</p>
        )}
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.updated")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(macro.updatedAt)}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.created")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(macro.createdAt)}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.createdBy")}</h4>
        <p className="text-muted-foreground text-sm">{macro.createdByName ?? "-"}</p>
      </div>

      {/* Compatible Protocols Section */}
      <div
        role="separator"
        aria-orientation="horizontal"
        className="text-muted-foreground border-t"
      />

      {isCreator ? (
        <MacroCompatibleProtocolsCard macroId={macroId} embedded />
      ) : (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">{t("macroSettings.compatibleProtocols")}</h4>
          <p className="text-muted-foreground text-sm">
            {compatibleProtocolsCount > 0
              ? `${compatibleProtocolsCount} ${compatibleProtocolsCount === 1 ? "protocol" : "protocols"}`
              : t("macroSettings.noCompatibleProtocols")}
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
                    {tCommon("common.confirmDelete", { name: macro.name })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    {t("macroSettings.cancel")}
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? t("macroSettings.deleting") : t("macroSettings.delete")}
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
