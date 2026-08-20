import type { ActivityEntry } from "@/components/iot-devices/monitoring/device-activity";

import type {
  IotDeviceGroupLifecycleEvent,
  IotDeviceGroupMemberHealth,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";

/**
 * Group lifecycle events as device-labeled log entries, newest first. Only the
 * broker's connect/disconnect kinds exist in the source table; anything else
 * would be a schema drift and is dropped rather than mislabeled.
 */
export function buildGroupActivity(
  events: IotDeviceGroupLifecycleEvent[],
  labelByDeviceId: Map<string, string>,
  unknownDeviceLabel: string,
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const event of events) {
    if (event.eventTimestamp === null) continue;
    if (event.eventType !== "connected" && event.eventType !== "disconnected") continue;

    const label =
      (event.deviceId === null ? undefined : labelByDeviceId.get(event.deviceId)) ??
      unknownDeviceLabel;

    entries.push({
      timestamp: event.eventTimestamp,
      kind: event.eventType,
      detail: event.disconnectReason === null ? label : `${label} · ${event.disconnectReason}`,
    });
  }

  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/** Display labels keyed by device id, for throughput series and the event log. */
export function memberLabels(
  members: IotDeviceGroupMemberHealth[],
  resolveLabel: (member: IotDeviceGroupMemberHealth) => string,
): Map<string, string> {
  return new Map(members.map((member) => [member.deviceId, resolveLabel(member)]));
}
