"use client";

import { AlertCircle, Battery, CheckCircle2, Loader2, Zap } from "lucide-react";
import { presentDevice, resolveDevicePrimaryLabel } from "~/util/device-presentation";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

interface DeviceInfo {
  device_name?: string;
  device_battery?: number;
  device_version?: string;
  device_id?: string;
}

interface DeviceStatusCardProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  deviceInfo: DeviceInfo | null;
  connectionType: "bluetooth" | "serial";
  /** The protocol's family, used to resolve product context for an unnamed device. */
  sensorFamily?: SensorFamily;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function DeviceStatusCard({
  isConnected,
  isConnecting,
  error,
  deviceInfo,
  connectionType,
  sensorFamily,
  onConnect,
  onDisconnect,
}: DeviceStatusCardProps) {
  const { t } = useTranslation("iot");

  // Shared identity hierarchy: name first, then canonical product name, then a
  // localized unknown-device fallback.
  const present = presentDevice({
    name: deviceInfo?.device_name,
    family: sensorFamily,
    id: deviceInfo?.device_id,
  });

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium">{t("iot.protocolRunner.device")}</h3>
      <div className="min-w-0 space-y-2 overflow-hidden rounded-lg border p-2.5">
        <div className="flex items-start gap-1.5">
          <div
            className={cn(
              "mt-0.5 shrink-0",
              isConnected ? "text-green-600" : "text-muted-foreground",
            )}
          >
            {isConnected ? <CheckCircle2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {isConnected ? (
                t("iot.protocolRunner.connected")
              ) : isConnecting ? (
                <span className="flex items-center">
                  {t("iot.protocolRunner.connecting")}
                  <span className="inline-block w-6 text-left">
                    <span className="after:inline-block after:animate-[ellipsis_2s_infinite] after:content-['.']" />
                  </span>
                </span>
              ) : (
                t("iot.protocolRunner.notConnected")
              )}
            </div>
            {isConnected ? (
              <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                <div className="truncate">{resolveDevicePrimaryLabel(present, t)}</div>
                {present.provenance === "name" && present.productName && (
                  <div className="truncate">{present.productName}</div>
                )}
                {deviceInfo?.device_version && (
                  <div>
                    {t("iot.protocolRunner.version")} {deviceInfo.device_version}
                  </div>
                )}
                {deviceInfo?.device_battery != null && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Battery className="h-3 w-3" />
                    <span>{deviceInfo.device_battery}%</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground mt-0.5 text-xs">
                {isConnecting
                  ? t("iot.protocolRunner.connectingToDevice")
                  : connectionType === "bluetooth"
                    ? t("iot.protocolRunner.wireless")
                    : t("iot.protocolRunner.usb")}
              </div>
            )}
          </div>
          <Button
            type="button"
            onClick={isConnected ? onDisconnect : onConnect}
            disabled={isConnecting}
            variant={isConnected ? "outline" : "default"}
            size="sm"
            className="shrink-0"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                {t("iot.protocolRunner.connecting")}
              </>
            ) : isConnected ? (
              t("iot.protocolRunner.disconnect")
            ) : (
              t("iot.protocolRunner.connect")
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
