"use client";

import { useLocale } from "@/hooks/useLocale";
import { presentDevice, resolveDevicePrimaryLabel } from "@/util/device-presentation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

import { IotDeviceDetailTabs } from "./iot-device-detail-tabs";
import { IotDeviceStatusBadge } from "./iot-device-status-badge";

interface IotDeviceLayoutContentProps {
  deviceId: string;
  device: IotDeviceDetail;
  children: React.ReactNode;
}

/**
 * Everything a device's routes share: the back link, the title with its status
 * badge, and the tab strip. Lives in the layout so all six tabs render under one
 * heading instead of each route rebuilding it.
 */
export function IotDeviceLayoutContent({
  deviceId,
  device,
  children,
}: IotDeviceLayoutContentProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  // Registry identity hierarchy: name, then canonical product name, then a
  // localized unknown-device fallback.
  const displayName = resolveDevicePrimaryLabel(
    presentDevice({ name: device.name, family: device.deviceType, id: device.serialNumber }),
    t,
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex w-full flex-col gap-6">
        <Link
          href={`/${locale}/platform/devices`}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("iot.devices.detail.back")}
        </Link>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-[#011111]">{displayName}</h1>
          <IotDeviceStatusBadge status={device.status} />
        </div>
      </div>

      <IotDeviceDetailTabs
        deviceId={deviceId}
        canShare={device.capabilities.canShare}
        canLeave={device.capabilities.canLeave}
        canManage={device.capabilities.canManage}
      >
        {children}
      </IotDeviceDetailTabs>
    </div>
  );
}
