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
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t("iot.protocolTester.device")}</h3>
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn("mt-0.5", isConnected ? "text-green-600" : "text-muted-foreground")}>
              {isConnected ? <CheckCircle2 className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {isConnected ? (
                  t("iot.protocolTester.connected")
                ) : isConnecting ? (
                  <span className="flex items-center">
                    {t("iot.protocolTester.connecting")}
                    <span className="inline-block w-6 text-left">
                      <span className="after:inline-block after:animate-[ellipsis_2s_infinite] after:content-['.']" />
                    </span>
                  </span>
                ) : (
                  t("iot.protocolTester.notConnected")
                )}
              </div>
              {isConnected && deviceInfo ? (
                <div className="text-muted-foreground mt-1 space-y-1 text-xs">
                  <div>{deviceInfo.device_name ?? t("iot.protocolTester.unknownDevice")}</div>
                  {deviceInfo.device_version && (
                    <div>
                      {t("iot.protocolTester.version")} {deviceInfo.device_version}
                    </div>
                  )}
                  {deviceInfo.device_battery && (
                    <div className="mt-2 flex items-center gap-2">
                      <Battery className="h-3.5 w-3.5" />
                      <span>{deviceInfo.device_battery}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground mt-1 text-xs">
                  {isConnecting
                    ? t("iot.protocolTester.pairingWithDevice")
                    : connectionType === "bluetooth"
                      ? t("iot.protocolTester.wireless")
                      : t("iot.protocolTester.usb")}
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={isConnected ? onDisconnect : onConnect}
            disabled={isConnecting}
            variant={isConnected ? "outline" : "default"}
            size="sm"
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isConnected ? (
              t("iot.protocolTester.disconnect")
            ) : (
              t("iot.protocolTester.connect")
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
