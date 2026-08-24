"use client";

import { formatDate } from "@/util/date";
import { presentDevice, resolveDeviceRoleLabels } from "@/util/device-presentation";
import { getSensorFamilyLabel } from "@/util/sensor-family";

import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

import { MetaField } from "../experiment-dashboards/meta-field";
import { VisibilityBadge } from "../visibility/visibility-badge";
import { useFormatLastSeen } from "./device-connectivity";

/**
 * The device's identity facts as the page header's meta strip, the way the
 * visualization header carries Created/Updated/By: present on every tab, so
 * no tab has to restate who the device is. Live state (status, connectivity)
 * stays beside the title, not here.
 */
export function DeviceMetaStrip({ device }: { device: IotDeviceDetail }) {
  const { t } = useTranslation("iot");
  const formatLastSeen = useFormatLastSeen();

  const present = presentDevice({
    name: device.name,
    family: device.deviceType,
    id: device.serialNumber,
  });
  const roleLabels = resolveDeviceRoleLabels(present, t);

  return (
    <div className="flex flex-wrap items-start gap-10">
      <MetaField label={t("iot.devices.detail.meta.serial")} value={device.serialNumber} />
      <MetaField
        label={t("iot.devices.detail.meta.type")}
        value={getSensorFamilyLabel(device.deviceType)}
      />
      {roleLabels.length > 0 && (
        <MetaField label={t("iot.devices.detail.meta.role")} value={roleLabels.join(" · ")} />
      )}
      <MetaField
        label={t("iot.devices.detail.meta.registered")}
        value={formatDate(device.createdAt)}
      />
      <MetaField label={t("iot.devices.detail.meta.thingName")} value={device.thingName} />
      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium leading-[18px] tracking-[0.02em]">
          {t("iot.devices.detail.meta.visibility")}
        </span>
        <VisibilityBadge visibility={device.visibility} />
      </div>
      <MetaField
        label={t("iot.devices.detail.meta.lastSeen")}
        value={formatLastSeen(device.connectivity)}
      />
    </div>
  );
}
