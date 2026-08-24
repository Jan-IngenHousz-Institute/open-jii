"use client";

import { IotDeviceCredentialsCard } from "@/components/iot-devices/iot-device-credentials-card";
import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

import { useTranslation } from "@repo/i18n";

interface DeviceCredentialsPageProps {
  params: Promise<{ deviceId: string }>;
}

/** Manage-gated device certificate controls; unauthorized direct visits redirect. */
export default function DeviceCredentialsPage({ params }: DeviceCredentialsPageProps) {
  const { deviceId } = use(params);
  const { t } = useTranslation("iot");
  const { data } = useIotDevice(deviceId);
  const router = useRouter();
  const locale = useLocale();

  const detailPath = `/${locale}/platform/devices/${deviceId}`;
  // Only once the capabilities are actually in hand: "not yet known" must not read
  // as "nothing to show here".
  const hasNoSurface = !!data && (!data.capabilities.canManage || data.deviceType === "mobile");

  useEffect(() => {
    // `replace`, not `push`: this route is not somewhere to come back to.
    if (hasNoSurface) router.replace(detailPath);
  }, [hasNoSurface, detailPath, router]);

  if (!data?.capabilities.canManage || data.deviceType === "mobile") return null;

  return (
    <div className="max-w-3xl">
      <TabBodyHeader
        title={t("iot.devices.credentials.tabTitle")}
        description={t("iot.devices.credentials.tabDescription")}
      />
      <IotDeviceCredentialsCard device={data} />
    </div>
  );
}
