import { DeviceGroupLayoutShell } from "@/components/iot-devices/groups/device-group-layout-shell";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { iotDeviceGroupQuery } from "@/hooks/iot/useIotDeviceGroup/iot-device-group-query";
import type { ReactNode } from "react";

interface DeviceGroupLayoutProps {
  children: ReactNode;
  params: Promise<{ groupId: string }>;
}

// Every tab waits on the group, so it comes with the page and the tab's own reads start at once.
export default async function DeviceGroupLayout({ children, params }: DeviceGroupLayoutProps) {
  const { groupId } = await params;

  return (
    <PrefetchedQueries queries={(utils) => [iotDeviceGroupQuery(utils, groupId)]}>
      <DeviceGroupLayoutShell>{children}</DeviceGroupLayoutShell>
    </PrefetchedQueries>
  );
}
