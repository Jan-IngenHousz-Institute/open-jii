"use client";

import { DeviceGroupsBlock } from "@/components/iot-devices/groups/device-groups-block";

import { IotDevicesTableView } from "./iot-devices-table-view";

/**
 * The devices overview: one surface, no section tabs.
 *
 * It replaces a five-tab strip whose Onboarding and Monitoring tabs were
 * coming-soon panels pointing away from capabilities that now exist a level
 * down, and whose Overview tab was stat tiles duplicating counts the status
 * filters already carry. Devices and groups co-exist here; everything else
 * lives on a device or a group.
 */
export function DevicesOverviewContent() {
  return (
    <div className="space-y-10">
      <IotDevicesTableView />
      <DeviceGroupsBlock />
    </div>
  );
}
