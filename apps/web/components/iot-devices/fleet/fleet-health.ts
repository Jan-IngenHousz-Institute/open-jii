import type { IotDeviceGroupMemberHealth } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import type {
  IotDeviceWithConnectivity,
  IotFleetDeviceActivity,
} from "@repo/api/domains/iot/iot.schema";

import { deviceNeedsCredentials } from "../device-next-action";
import { isMemberSilent } from "../groups/group-health";

/**
 * The fleet in the shared member-health shape, so the group dashboard's
 * online/silent policies apply unchanged instead of being re-derived here.
 */
export function toFleetHealth(
  devices: IotDeviceWithConnectivity[],
  activity: IotFleetDeviceActivity[],
): IotDeviceGroupMemberHealth[] {
  const lastDataByDevice = new Map(activity.map((entry) => [entry.deviceId, entry.lastDataAt]));

  return devices.map((device) => ({
    deviceId: device.id,
    name: device.name,
    serialNumber: device.serialNumber,
    deviceType: device.deviceType,
    connectivity: device.connectivity,
    lastDataAt: lastDataByDevice.get(device.id) ?? null,
  }));
}

export type FleetAttentionReason = "credentials" | "neverConnected" | "silent";

export interface FleetAttentionEntry {
  device: IotDeviceWithConnectivity;
  reason: FleetAttentionReason;
}

/**
 * The devices whose setup or delivery is stuck, one reason each, most
 * actionable first. A missing certificate outranks everything because nothing
 * else about the device can move until it exists; "never connected" is a
 * credentialed device the broker has still not seen; "silent" reuses the
 * shared connected-but-not-delivering policy. Phones are exempt throughout,
 * and an unknown fleet index claims nothing.
 */
export function fleetAttention(
  devices: IotDeviceWithConnectivity[],
  activity: IotFleetDeviceActivity[],
  pipelineUnavailable: boolean,
  now: number,
): FleetAttentionEntry[] {
  const health = toFleetHealth(devices, activity);
  const healthByDevice = new Map(health.map((member) => [member.deviceId, member]));

  const entries: FleetAttentionEntry[] = [];
  for (const device of devices) {
    if (device.deviceType === "mobile") {
      continue;
    }
    if (deviceNeedsCredentials(device)) {
      entries.push({ device, reason: "credentials" });
      continue;
    }
    if (device.connectivity !== null && !device.connectivity.connected) {
      if (device.connectivity.lastSeenAt === null) {
        entries.push({ device, reason: "neverConnected" });
      }
      continue;
    }
    const member = healthByDevice.get(device.id);
    if (member !== undefined && isMemberSilent(member, pipelineUnavailable, now)) {
      entries.push({ device, reason: "silent" });
    }
  }

  const priority: Record<FleetAttentionReason, number> = {
    credentials: 0,
    neverConnected: 1,
    silent: 2,
  };
  return entries.sort((a, b) => priority[a.reason] - priority[b.reason]);
}
