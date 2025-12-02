"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { Protocol } from "@repo/api";
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

import { useProtocolDelete } from "../../hooks/protocol/useProtocolDelete/useProtocolDelete";

interface ProtocolInfoCardProps {
  protocolId: string;
  protocol: Protocol;
}

export function ProtocolInfoCard({ protocolId, protocol }: ProtocolInfoCardProps) {
  const { mutateAsync: deleteProtocol, isPending: isDeleting } = useProtocolDelete(protocolId);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.PROTOCOL_DELETION);

  const handleDeleteProtocol = async () => {
    await deleteProtocol({ params: { id: protocolId } });
    setIsDeleteDialogOpen(false);
    // Navigate to protocols list
    router.push(`/${locale}/platform/protocols`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("protocolSettings.protocolInfo")}</CardTitle>
        <CardDescription>{t("protocolSettings.protocolInfoDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">{t("protocolSettings.created")}:</span>{" "}
            {formatDate(protocol.createdAt)}
          </div>
          <div>
            <span className="font-medium">{t("protocolSettings.updated")}:</span>{" "}
            {formatDate(protocol.updatedAt)}
          </div>
          <div>
            <span className="font-medium">{t("protocols.protocolId")}:</span>{" "}
            <span className="font-mono text-xs">{protocol.id}</span>
          </div>
        </div>

        {isDeletionEnabled && (
          <div className="border-t pt-4">
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
                    {t("common.confirmDelete", { name: protocol.name })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    {t("protocolSettings.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteProtocol}
                    disabled={isDeleting}
                  >
                    {isDeleting ? t("protocolSettings.deleting") : t("protocolSettings.delete")}
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
