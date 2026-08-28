"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useIssueIotCredentials } from "@/hooks/iot/useIssueIotCredentials/useIssueIotCredentials";
import { useRevokeIotCredentials } from "@/hooks/iot/useRevokeIotCredentials/useRevokeIotCredentials";
import { useRotateIotCredentials } from "@/hooks/iot/useRotateIotCredentials/useRotateIotCredentials";
import { orpc } from "@/lib/orpc";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { useState } from "react";

import type {
  IotDeviceWithConnectivity,
  IssueIotCredentialsResponse,
} from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { CopyButton } from "@repo/ui/components/copy-button";
import { toast } from "@repo/ui/hooks/use-toast";

import { CredentialConfirmDialog } from "./credential-confirm-dialog";
import { IotCredentialsDialog } from "./iot-credentials-dialog";

export function IotDeviceCredentialsCard({ device }: { device: IotDeviceWithConnectivity }) {
  const { t } = useTranslation("iot");
  const queryClient = useQueryClient();
  const [issued, setIssued] = useState<IssueIotCredentialsResponse | null>(null);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const isConnected = device.connectivity?.connected === true;

  const showCredentials = (credentials: IssueIotCredentialsResponse) => setIssued(credentials);

  const { mutate: issue, isPending: isIssuing } = useIssueIotCredentials({
    onSuccess: showCredentials,
  });
  const { mutate: rotate, isPending: isRotating } = useRotateIotCredentials({
    onSuccess: (credentials) => {
      showCredentials(credentials);
      setConfirmingRotate(false);
    },
  });
  const { mutate: revoke, isPending: isRevoking } = useRevokeIotCredentials({
    onSuccess: () => {
      toast({ title: t("iot.devices.credentials.revokeSuccess") });
      setConfirmingRevoke(false);
    },
  });

  const onIssueError = () =>
    toast({ title: t("iot.devices.credentials.issueError"), variant: "destructive" });

  const handleIssue = () => issue({ deviceId: device.id }, { onError: onIssueError });
  const handleRotate = () => rotate({ deviceId: device.id }, { onError: onIssueError });
  const handleRevoke = () =>
    revoke(
      { deviceId: device.id },
      {
        onError: () =>
          toast({ title: t("iot.devices.credentials.revokeError"), variant: "destructive" }),
      },
    );

  return (
    <SettingsCard title={t("iot.devices.detail.credentials.title")} contentClassName="space-y-4">
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
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">
              {t("iot.devices.credentials.activeLabel")}
            </p>
            <p className="text-muted-foreground text-sm">
              {t("iot.devices.detail.cards.credentialHint.active")}
            </p>
          </div>

          <dl className="bg-muted/50 space-y-3 rounded-lg p-3">
            {device.certificateId !== null && (
              <div>
                <dt className="text-xs font-medium">
                  {t("iot.devices.credentials.certificateIdLabel")}
                </dt>
                <dd className="flex items-start gap-1">
                  <span className="text-muted-foreground min-w-0 flex-1 break-all font-mono text-xs">
                    {device.certificateId}
                  </span>
                  <CopyButton
                    value={device.certificateId}
                    label={t("iot.onboarding.rail.copy")}
                    copiedLabel={t("iot.onboarding.rail.copied")}
                  />
                </dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirmingRotate(true)}>
              <RefreshCw className="mr-2 h-4 w-4" />
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
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {t("iot.devices.credentials.rotatingDescription")}
          </p>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => {
              void queryClient.invalidateQueries({
                queryKey: orpc.iot.getIotDevice.queryOptions({
                  input: { deviceId: device.id },
                }).queryKey,
              });
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("iot.devices.credentials.refreshStatus")}
          </Button>
        </div>
      )}

      <IotCredentialsDialog
        deviceId={device.id}
        thingName={device.thingName}
        credentials={issued}
        onOpenChange={(open) => {
          if (!open) setIssued(null);
        }}
      />

      <CredentialConfirmDialog
        open={confirmingRotate}
        onOpenChange={setConfirmingRotate}
        title={t("iot.devices.credentials.rotateTitle")}
        description={t("iot.devices.credentials.rotateConfirm")}
        warning={isConnected ? t("iot.devices.credentials.disconnectWarning") : undefined}
        actionLabel={t("iot.devices.credentials.rotate")}
        pending={isRotating}
        onConfirm={handleRotate}
      />

      <CredentialConfirmDialog
        open={confirmingRevoke}
        onOpenChange={setConfirmingRevoke}
        title={t("iot.devices.credentials.revokeTitle")}
        description={t("iot.devices.credentials.revokeConfirm")}
        warning={isConnected ? t("iot.devices.credentials.disconnectWarning") : undefined}
        actionLabel={t("iot.devices.credentials.revoke")}
        destructive
        pending={isRevoking}
        onConfirm={handleRevoke}
      />
    </SettingsCard>
  );
}
