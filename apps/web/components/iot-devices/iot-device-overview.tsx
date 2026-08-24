"use client";

import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { formatDate } from "@/util/date";
import { presentDevice, resolveDeviceRoleLabels } from "@/util/device-presentation";
import { getSensorFamilyLabel } from "@/util/sensor-family";

import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

import { MetaField } from "../experiment-dashboards/meta-field";
import { useFormatLastSeen } from "./device-connectivity";
import { deviceNextAction } from "./device-next-action";
import { DeviceNextActionChip } from "./device-next-action-chip";
import { DeviceOverviewCards } from "./device-overview-cards";

/** The stitched hub: metadata and summary cards into the neighbouring tabs.
 * Whole-device actions live in the header's overflow menu, not here. */
export function IotDeviceOverview({ device }: { device: IotDeviceDetail }) {
  const { t } = useTranslation("iot");

  const { data: boundExperiments } = useDeviceExperiments(device.id);
  const nextAction = deviceNextAction(device, boundExperiments?.length ?? null);

  const present = presentDevice({
    name: device.name,
    family: device.deviceType,
    id: device.serialNumber,
  });
  const roleLabels = resolveDeviceRoleLabels(present, t);
  const formatLastSeen = useFormatLastSeen();

  const connectivityLabel = (connectivity: IotDeviceDetail["connectivity"]) => {
    if (connectivity === null) {
      return t("iot.devices.connectivity.unknown");
    }
    return connectivity.connected
      ? t("iot.devices.connectivity.connected")
      : t("iot.devices.connectivity.disconnected");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TabBodyHeader
          title={t("iot.devices.detail.overview.title")}
          description={t("iot.devices.detail.overview.description")}
        />
        {nextAction !== null && <DeviceNextActionChip deviceId={device.id} action={nextAction} />}
      </div>

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
          label={t("iot.devices.detail.meta.status")}
          value={t(`iot.devices.status.${device.status}`)}
        />
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
          label={t("iot.devices.detail.meta.connectivity")}
          value={connectivityLabel(device.connectivity)}
        />
        <MetaField
          label={t("iot.devices.detail.meta.lastSeen")}
          value={formatLastSeen(device.connectivity)}
        />
      </div>

      {/* The component hides the certificate and onboarding cards for phones
          itself; activity applies to every family. */}
      <DeviceOverviewCards device={device} />
    </div>
  );
}
