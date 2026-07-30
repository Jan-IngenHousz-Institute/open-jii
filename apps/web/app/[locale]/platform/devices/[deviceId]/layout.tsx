"use client";

import { IotDeviceLayoutContent } from "@/components/iot-devices/iot-device-layout-content";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";

interface DeviceLayoutProps {
  children: React.ReactNode;
}

/**
 * Loads the device once for every tab under it, and owns the header + strip. Each
 * tab route then resolves the same query from cache and adds no request.
 */
export default function DeviceLayout({ children }: DeviceLayoutProps) {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { t } = useTranslation("iot");
  const { data, isLoading, error } = useIotDevice(deviceId);

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={!!data}
      errorDescription={t("iot.devices.loadError")}
    >
      {data && (
        <IotDeviceLayoutContent deviceId={deviceId} device={data}>
          {children}
        </IotDeviceLayoutContent>
      )}
    </EntityLayoutShell>
  );
}
