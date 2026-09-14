"use client";

import { useIotBrowserSupport } from "@/hooks/iot/useIotBrowserSupport";
import type { IotDeviceConnection } from "@/hooks/iot/useIotConnections/useIotConnections";
import { Cable, Loader2 } from "lucide-react";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

interface CalibrationConnectStepProps {
  family: SensorFamily;
  connection: IotDeviceConnection | undefined;
  isConnecting: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

/** The platform never reaches hardware; this browser session is the only bridge. */
export function CalibrationConnectStep({
  family,
  connection,
  isConnecting,
  error,
  onConnect,
  onDisconnect,
}: CalibrationConnectStepProps) {
  const { t } = useTranslation("iot");
  const support = useIotBrowserSupport(family);

  const isWrongFamily = connection !== undefined && connection.family !== family;
  const unsupportedReason =
    support.serialReason === "browser"
      ? t("iot.calibration.connect.unsupportedBrowser")
      : support.serialReason === "device"
        ? t("iot.calibration.connect.unsupportedDevice")
        : null;

  function renderConnected(connected: IotDeviceConnection) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm">
          <Cable className="size-4" aria-hidden />
          {t("iot.calibration.connect.connected", { name: connected.label })}
          {connected.identity.firmwareVersion !== undefined && (
            <span className="text-muted-foreground font-mono text-xs">
              {connected.identity.firmwareVersion}
            </span>
          )}
        </p>
        {isWrongFamily && (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.connect.wrongFamily", {
                expected: family,
                actual: connected.family,
              })}
            </AlertDescription>
          </Alert>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onDisconnect}>
          {t("iot.calibration.connect.disconnect")}
        </Button>
      </div>
    );
  }

  if (connection) {
    return renderConnected(connection);
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t("iot.calibration.connect.hint")}</p>
      {unsupportedReason !== null && (
        <Alert>
          <AlertDescription>{unsupportedReason}</AlertDescription>
        </Alert>
      )}
      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="button" onClick={onConnect} disabled={isConnecting || !support.serial}>
        {isConnecting ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Cable className="mr-2 size-4" aria-hidden />
        )}
        {isConnecting
          ? t("iot.calibration.connect.connecting")
          : t("iot.calibration.connect.action")}
      </Button>
    </div>
  );
}
