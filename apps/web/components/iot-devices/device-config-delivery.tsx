"use client";

import { ConnectionTypeSelector } from "@/components/iot/iot-connection-type-selector";
import { sensorFamilyToDeviceType } from "@/hooks/iot/device-type-mapping";
import { useIotBrowserSupport } from "@/hooks/iot/useIotBrowserSupport";
import { useIotCommunication } from "@/hooks/iot/useIotCommunication/useIotCommunication";
import type { ConnectionType } from "@/hooks/iot/useIotCommunication/useIotCommunication";
import { Download, Loader2, Send, Usb } from "lucide-react";
import { useState } from "react";

import type { DeviceOnboardingConfig, IotDevice } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";
import { deliverDeviceConfig, supportsConfigDelivery } from "@repo/iot";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { downloadText } from "./iot-credential-file";

interface DeviceConfigDeliveryProps {
  device: IotDevice;
  config: DeviceOnboardingConfig;
}

export function DeviceConfigDelivery({ device, config }: DeviceConfigDeliveryProps) {
  const { t } = useTranslation("iot");
  const [connectionType, setConnectionType] = useState<ConnectionType>("serial");
  const [isPushing, setIsPushing] = useState(false);

  const browserSupport = useIotBrowserSupport(device.deviceType);
  const { isConnected, isConnecting, error, driver, connect, disconnect } = useIotCommunication(
    device.deviceType,
    connectionType,
  );

  // MultispeQ has no stored-config command, so delivery for it is download-only.
  const supportsPush = supportsConfigDelivery(sensorFamilyToDeviceType(device.deviceType));
  const showConnectError = error !== null && !isConnected && !isConnecting;

  const handleDownload = () => {
    downloadText(`${device.thingName}-config.json`, JSON.stringify(config, null, 2));
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
      await deliverDeviceConfig(driver, { config: { ...config }, id: config.thingName });
      toast({ title: t("iot.onboarding.pushSuccess") });
    } catch {
      toast({ title: t("iot.onboarding.pushError"), variant: "destructive" });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePush = () => {
    void pushConfig();
  };

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t("iot.onboarding.deliveryTitle")}</h3>
        <p className="text-muted-foreground text-xs">{t("iot.onboarding.deliveryDescription")}</p>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
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
        <Button variant="outline" onClick={handleDownload}>
          <Download className="mr-1.5 h-4 w-4" />
          {t("iot.onboarding.download")}
        </Button>

        {supportsPush && !isConnected && (
          <Button onClick={handleConnect} disabled={isConnecting}>
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
            <Button onClick={handlePush} disabled={isPushing}>
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

      {showConnectError && (
        <p className="text-destructive text-xs">{t("iot.onboarding.connectError")}</p>
      )}

      {!supportsPush && (
        <p className="text-muted-foreground text-xs">{t("iot.onboarding.multispeqNote")}</p>
      )}
    </section>
  );
}
