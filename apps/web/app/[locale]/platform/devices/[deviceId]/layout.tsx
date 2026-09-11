"use client";

import { IotDeviceLayoutContent } from "@/components/iot-devices/iot-device-layout-content";
import { PlatformHeaderDetail } from "@/components/navigation/site-header/platform-header-context";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { presentDevice, resolveDevicePrimaryLabel } from "@/util/device-presentation";
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
  const locale = useLocale();
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
        <>
          <PlatformHeaderDetail
            href={`/${locale}/platform/devices/${deviceId}`}
            label={resolveDevicePrimaryLabel(
              presentDevice({
                name: data.name,
                family: data.deviceType,
                id: data.serialNumber,
              }),
              t,
            )}
          />
          <IotDeviceLayoutContent deviceId={deviceId} device={data}>
            {children}
          </IotDeviceLayoutContent>
        </>
      )}
    </EntityLayoutShell>
  );
}
