"use client";

import { useIssueIotCredentials } from "@/hooks/iot/useIssueIotCredentials/useIssueIotCredentials";
import { useRevokeIotCredentials } from "@/hooks/iot/useRevokeIotCredentials/useRevokeIotCredentials";
import { useRotateIotCredentials } from "@/hooks/iot/useRotateIotCredentials/useRotateIotCredentials";
import { KeyRound, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { useState } from "react";

import type { IotDevice, IssueIotCredentialsResponse } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { toast } from "@repo/ui/hooks/use-toast";

import { IotCredentialsDialog } from "./iot-credentials-dialog";

export function IotDeviceCredentialsCard({ device }: { device: IotDevice }) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const [issued, setIssued] = useState<IssueIotCredentialsResponse | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const showCredentials = (credentials: IssueIotCredentialsResponse) => setIssued(credentials);

  const { mutate: issue, isPending: isIssuing } = useIssueIotCredentials({
    onSuccess: showCredentials,
  });
  const { mutate: rotate, isPending: isRotating } = useRotateIotCredentials({
    onSuccess: showCredentials,
  });
  const { mutate: revoke, isPending: isRevoking } = useRevokeIotCredentials({
    onSuccess: () => {
      toast({ title: t("iot.devices.credentials.revokeSuccess") });
      setConfirmingRevoke(false);
    },
  });

  const onIssueError = () =>
    toast({ title: t("iot.devices.credentials.issueError"), variant: "destructive" });

  const handleIssue = () =>
    issue({ params: { deviceId: device.id }, body: {} }, { onError: onIssueError });
  const handleRotate = () =>
    rotate({ params: { deviceId: device.id }, body: {} }, { onError: onIssueError });
  const handleRevoke = () =>
    revoke(
      { params: { deviceId: device.id } },
      {
        onError: () =>
          toast({ title: t("iot.devices.credentials.revokeError"), variant: "destructive" }),
      },
    );

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{t("iot.devices.detail.credentials.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(device.status === "pending" || device.status === "revoked") && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              {device.status === "revoked"
                ? t("iot.devices.credentials.revokedDescription")
                : t("iot.devices.credentials.pendingDescription")}
            </p>
            <Button className="w-fit" onClick={handleIssue} disabled={isIssuing}>
              {isIssuing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {device.status === "revoked"
                ? t("iot.devices.credentials.reissue")
                : t("iot.devices.credentials.issue")}
            </Button>
          </div>
        )}

        {device.status === "active" && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-[#011111]">
                {t("iot.devices.credentials.activeLabel")}
              </p>
              {device.certificateId !== null && (
                <p className="text-muted-foreground truncate font-mono text-xs">
                  {device.certificateId}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleRotate} disabled={isRotating}>
                {isRotating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t("iot.devices.credentials.rotate")}
              </Button>
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmingRevoke(true)}
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                {t("iot.devices.credentials.revoke")}
              </Button>
            </div>
          </div>
        )}

        {device.status === "rotating" && (
          <p className="text-muted-foreground text-sm">
            {t("iot.devices.credentials.rotatingDescription")}
          </p>
        )}
      </CardContent>

      <IotCredentialsDialog
        thingName={device.thingName}
        credentials={issued}
        onOpenChange={(open) => {
          if (!open) setIssued(null);
        }}
      />

      <AlertDialog open={confirmingRevoke} onOpenChange={setConfirmingRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("iot.devices.credentials.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("iot.devices.credentials.revokeConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRevoking}
              onClick={(e) => {
                e.preventDefault();
                handleRevoke();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("iot.devices.credentials.revoke")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
