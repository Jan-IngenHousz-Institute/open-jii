"use client";

import { IotDeviceOverview } from "@/components/iot-devices/iot-device-overview";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { use } from "react";

interface DeviceOverviewPageProps {
  params: Promise<{ deviceId: string }>;
}

/**
 * A device's Overview tab. The layout has already loaded the device (and gated on
 * it) before this renders, so the hook resolves from cache and adds no request.
 */
export default function DeviceOverviewPage({ params }: DeviceOverviewPageProps) {
  const { deviceId } = use(params);
  const { data } = useIotDevice(deviceId);

  return data ? <IotDeviceOverview device={data} /> : null;
}
