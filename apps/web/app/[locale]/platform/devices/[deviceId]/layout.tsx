import { DeviceLayoutShell } from "@/components/iot-devices/device-layout-shell";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { iotDeviceQuery } from "@/hooks/iot/useIotDevice/iot-device-query";
import type { ReactNode } from "react";

interface DeviceLayoutProps {
  children: ReactNode;
  params: Promise<{ deviceId: string }>;
}

// Every tab waits on the device, so it comes with the page and the tab's own reads start at once.
export default async function DeviceLayout({ children, params }: DeviceLayoutProps) {
  const { deviceId } = await params;

  return (
    <PrefetchedQueries queries={(utils) => [iotDeviceQuery(utils, deviceId)]}>
      <DeviceLayoutShell>{children}</DeviceLayoutShell>
    </PrefetchedQueries>
  );
}
