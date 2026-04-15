"use client";

import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";
import { getSensorFamilyLabel, SENSOR_FAMILY_OPTIONS } from "~/util/sensor-family";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Protocol, SensorFamily } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@repo/ui/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { toast } from "@repo/ui/hooks/use-toast";

import { useProtocolCompatibleMacros } from "../../hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { useProtocolDelete } from "../../hooks/protocol/useProtocolDelete/useProtocolDelete";
import { ProtocolCompatibleMacrosCard } from "../protocol-settings/protocol-compatible-macros-card";
import { DetailsSidebarCard } from "../shared/details-sidebar-card";

interface ProtocolDetailsSidebarProps {
  protocolId: string;
  protocol: Protocol;
}

export function ProtocolDetailsSidebar({ protocolId, protocol }: ProtocolDetailsSidebarProps) {
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const locale = useLocale();
  const router = useRouter();

  const isCreator = session?.user.id === protocol.createdBy;
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.PROTOCOL_DELETION);

  const { mutateAsync: updateProtocol, isPending: isUpdating } = useProtocolUpdate(protocolId);
  const { mutateAsync: deleteProtocol, isPending: isDeleting } = useProtocolDelete(protocolId);
  const { data: compatibleMacrosData } = useProtocolCompatibleMacros(protocolId);
  const compatibleMacrosCount = compatibleMacrosData?.body.length ?? 0;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleFamilyChange = async (newFamily: string) => {
    await updateProtocol(
      {
        params: { id: protocolId },
        body: { family: newFamily as SensorFamily },
      },
      {
        onSuccess: () => {
          toast({ description: t("protocols.protocolUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = async () => {
    await deleteProtocol({ params: { id: protocolId } });
    setIsDeleteDialogOpen(false);
    router.push(`/${locale}/platform/protocols`);
  };

  return (
    <DetailsSidebarCard
      title={t("protocols.detailsTitle")}
      collapsedSummary={`${tCommon("common.updated")} ${formatDate(protocol.updatedAt)}, ${t("protocols.protocolId")} ${protocol.id.slice(0, 8)}...`}
    >
      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("protocols.protocolId")}</h4>
        <p className="text-muted-foreground font-mono text-sm">{protocol.id}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("protocols.family")}</h4>
        {isCreator ? (
          <Select value={protocol.family} onValueChange={handleFamilyChange} disabled={isUpdating}>
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
            {getSensorFamilyLabel(protocol.family)}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.updated")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(protocol.updatedAt)}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{tCommon("common.created")}</h4>
        <p className="text-muted-foreground text-sm">{formatDate(protocol.createdAt)}</p>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("experiments.createdBy")}</h4>
        <p className="text-muted-foreground text-sm">{protocol.createdByName ?? "-"}</p>
      </div>

      {/* Compatible Macros Section */}
      <div
        role="separator"
        aria-orientation="horizontal"
        className="text-muted-foreground border-t"
      />

      {isCreator ? (
        <ProtocolCompatibleMacrosCard protocolId={protocolId} embedded />
      ) : (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">{t("protocolSettings.compatibleMacros")}</h4>
          <p className="text-muted-foreground text-sm">
            {compatibleMacrosCount > 0
              ? `${compatibleMacrosCount} ${compatibleMacrosCount === 1 ? "macro" : "macros"}`
              : t("protocolSettings.noCompatibleMacros")}
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
              {t("protocolSettings.dangerZone")}
            </h5>
            <p className="text-muted-foreground mb-4 text-sm">
              {t("protocolSettings.deleteWarning")}
            </p>
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">{t("protocolSettings.deleteProtocol")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-destructive">
                    {t("protocolSettings.deleteProtocol")}
                  </DialogTitle>
                  <DialogDescription>
                    {tCommon("common.confirmDelete", { name: protocol.name })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    {t("protocolSettings.cancel")}
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? t("protocolSettings.deleting") : t("protocolSettings.delete")}
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
