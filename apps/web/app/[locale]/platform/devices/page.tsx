import { DevicesOverviewContent } from "@/components/iot-devices/devices-overview-content";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { iotDeviceGroupsQuery } from "@/hooks/iot/useIotDeviceGroups/iot-device-groups-query";
import { iotDevicesQuery } from "@/hooks/iot/useIotDevices/iot-devices-query";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

interface DevicesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: DevicesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });

  return { title: t("iot.devices.title") };
}

export default function DevicesPage() {
  // The fleet's warehouse panels stay in the browser: a slow read would hold the whole page.
  return (
    <PrefetchedQueries queries={(utils) => [iotDevicesQuery(utils), iotDeviceGroupsQuery(utils)]}>
      <DevicesOverviewContent />
    </PrefetchedQueries>
  );
}
