"use client";

import { ConnectionTypeSelector } from "@/components/iot/iot-connection-type-selector";
import { sensorFamilyToDeviceType } from "@/hooks/iot/device-type-mapping";
import { useAutoConnectionType } from "@/hooks/iot/useAutoConnectionType";
import { useIotBrowserSupport } from "@/hooks/iot/useIotBrowserSupport";
import { useIotCommunication } from "@/hooks/iot/useIotCommunication/useIotCommunication";
import type { ConnectionType } from "@/hooks/iot/useIotCommunication/useIotCommunication";
import { Download, Loader2, Send, Usb } from "lucide-react";
import { useState } from "react";
import { env } from "~/env";

import type { DeviceOnboardingConfig, IotDevice } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { deliverDeviceConfig, supportsConfigDelivery } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { toast } from "@repo/ui/hooks/use-toast";

import { downloadText } from "./iot-credential-file";

interface DeviceConfigDeliveryProps {
  device: IotDevice;
  config: DeviceOnboardingConfig;
  disabled?: boolean;
  disabledHint?: string | null;
}

export function DeviceConfigDelivery({
  device,
  config,
  disabled = false,
  disabledHint = null,
}: DeviceConfigDeliveryProps) {
  const { t } = useTranslation("iot");
  const [connectionType, setConnectionType] = useState<ConnectionType>("serial");
  const [isPushing, setIsPushing] = useState(false);

  const browserSupport = useIotBrowserSupport(device.deviceType);
  useAutoConnectionType(browserSupport, setConnectionType);

  const { isConnected, isConnecting, error, driver, connect, disconnect } = useIotCommunication(
    device.deviceType,
    connectionType,
  );

  // Families without a stored-config command (MultispeQ, Ambit/Ambyte, MiniPAR)
  // get their procedure per measurement, so delivery for them is download-only.
  const supportsPush = supportsConfigDelivery(sensorFamilyToDeviceType(device.deviceType));
  const isSelectedTransportSupported =
    connectionType === "bluetooth" ? browserSupport.bluetooth : browserSupport.serial;
  const showConnectError = error !== null && !isConnected && !isConnecting;

  // The file travels detached from the UI, so it names where its own contract
  // is documented.
  const deliveredFile = {
    ...config,
    docsUrl: `${env.NEXT_PUBLIC_DOCS_URL}/developers/device-integration`,
  };

  const handleDownload = () => {
    downloadText(`${device.thingName}-config.json`, JSON.stringify(deliveredFile, null, 2));
  };

  const handleConnect = () => {
    void connect();
  };

  const handleDisconnect = () => {
    void disconnect();
  };

  const handleConnectionTypeChange = (type: ConnectionType) => {
    setConnectionType(type);
  };

  const pushConfig = async () => {
    if (!driver) {
      return;
    }
    setIsPushing(true);
    try {
      await deliverDeviceConfig(driver, { config: { ...deliveredFile }, id: config.thingName });
      toast({ title: t("iot.onboarding.pushSuccess") });
    } catch (pushError) {
      // The driver's message states exactly why (e.g. SET_CONFIG unsupported).
      toast({
        title: t("iot.onboarding.pushError"),
        description: pushError instanceof Error ? pushError.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePush = () => {
    void pushConfig();
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{t("iot.onboarding.deliveryTitle")}</CardTitle>
        <CardDescription>{t("iot.onboarding.deliveryDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 space-y-2 rounded-lg p-3">
          <p className="text-xs font-medium">{t("iot.onboarding.endpointLabel")}</p>
          <p className="text-muted-foreground break-all font-mono text-xs">{config.endpoint}</p>

          <p className="pt-1 text-xs font-medium">{t("iot.onboarding.topicsLabel")}</p>
          <ul className="space-y-1">
            {config.experiments.map((experiment) => (
              <li key={experiment.experimentId} className="text-muted-foreground font-mono text-xs">
                {experiment.topicPrefix}
              </li>
            ))}
          </ul>
        </div>

        {supportsPush && !isConnected && (
          <ConnectionTypeSelector
            connectionType={connectionType}
            onConnectionTypeChange={handleConnectionTypeChange}
            browserSupport={browserSupport}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={disabled}>
            <Download className="mr-1.5 h-4 w-4" />
            {t("iot.onboarding.download")}
          </Button>

          {supportsPush && !isConnected && (
            <Button
              onClick={handleConnect}
              disabled={disabled || isConnecting || !isSelectedTransportSupported}
            >
              {isConnecting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Usb className="mr-1.5 h-4 w-4" />
              )}
              {t("iot.onboarding.connect")}
            </Button>
          )}

          {supportsPush && isConnected && (
            <>
              <Button onClick={handlePush} disabled={disabled || isPushing}>
                {isPushing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                {t("iot.onboarding.push")}
              </Button>
              <Button variant="outline" onClick={handleDisconnect}>
                {t("iot.onboarding.disconnect")}
              </Button>
            </>
          )}
        </div>

        {disabledHint !== null && <p className="text-muted-foreground text-xs">{disabledHint}</p>}

        {showConnectError && (
          <p className="text-destructive text-xs">{t("iot.onboarding.connectError")}</p>
        )}

        {!supportsPush && (
          <p className="text-muted-foreground text-xs">{t("iot.onboarding.inlineProcedureNote")}</p>
        )}
      </CardContent>
    </Card>
  );
}
