"use client";

import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";

import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

import { DeviceAboutCard } from "./device-about-card";
import { deviceNextAction } from "./device-next-action";
import { DeviceNextActionChip } from "./device-next-action-chip";
import { DeviceOverviewCards } from "./device-overview-cards";

/** The stitched hub: summary cards into the neighbouring tabs. Identity
 * facts live in the page header's meta strip, whole-device actions in its
 * overflow menu; this tab is about where to go next. */
export function IotDeviceOverview({ device }: { device: IotDeviceDetail }) {
  const { t } = useTranslation("iot");

  const { data: boundExperiments } = useDeviceExperiments(device.id);
  const nextAction = deviceNextAction(device, boundExperiments?.length ?? null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TabBodyHeader
          title={t("iot.devices.detail.overview.title")}
          description={t("iot.devices.detail.overview.description")}
        />
        {nextAction !== null && <DeviceNextActionChip deviceId={device.id} action={nextAction} />}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {/* The component hides the certificate and onboarding cards for phones
              itself; activity applies to every family. */}
          <DeviceOverviewCards device={device} />
        </div>
        <DeviceAboutCard device={device} />
      </div>
    </div>
  );
}
