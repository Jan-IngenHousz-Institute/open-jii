"use client";

import { FleetOverviewDashboard } from "@/components/iot-devices/fleet/fleet-overview-dashboard";
import { DeviceGroupsBlock } from "@/components/iot-devices/groups/device-groups-block";
import { WorkspaceBand } from "@/components/workspace-band";

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
    <WorkspaceBand>
      <div className="space-y-10">
        <FleetOverviewDashboard />
        <IotDevicesTableView />
        <DeviceGroupsBlock />
      </div>
    </WorkspaceBand>
  );
}
