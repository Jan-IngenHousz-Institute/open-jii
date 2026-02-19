"use client";

import { AlertCircle, Battery, CheckCircle2, Loader2, Zap } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription, Button } from "@repo/ui/components";
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
  onConnect: () => void;
  onDisconnect: () => void;
}

export function DeviceStatusCard({
  isConnected,
  isConnecting,
  error,
  deviceInfo,
  connectionType,
  onConnect,
  onDisconnect,
}: DeviceStatusCardProps) {
  const { t } = useTranslation("iot");

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
            {isConnected && deviceInfo ? (
              <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                <div className="truncate">
                  {deviceInfo.device_name ?? t("iot.protocolRunner.unknownDevice")}
                </div>
                {deviceInfo.device_version && (
                  <div>
                    {t("iot.protocolRunner.version")} {deviceInfo.device_version}
                  </div>
                )}
                {deviceInfo.device_battery && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Battery className="h-3 w-3" />
                    <span>{deviceInfo.device_battery}%</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground mt-0.5 text-xs">
                {isConnecting
                  ? t("iot.protocolRunner.pairingWithDevice")
                  : connectionType === "bluetooth"
                    ? t("iot.protocolRunner.wireless")
                    : t("iot.protocolRunner.usb")}
              </div>
            )}
          </div>
        </div>
        <Button
          type="button"
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting}
          variant={isConnected ? "outline" : "default"}
          size="sm"
          className="w-full"
        >
          {isConnecting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className="truncate">
              {isConnected ? t("iot.protocolRunner.disconnect") : t("iot.protocolRunner.connect")}
            </span>
          )}
        </Button>

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
