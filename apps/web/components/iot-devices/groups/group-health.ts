import type { DeviceGroupMemberHealth } from "@repo/api/domains/device-group/device-group.schema";

import { SILENT_THRESHOLD_MS } from "../monitoring/silent-threshold";

export interface GroupHealthSummary {
  total: number;
  online: number;
  unknown: number;
  silent: number;
}

/**
 * Connected but not delivering, same policy as the device tiles. Phones are
 * exempt: they connect only while the app is open, so silence is their normal.
 */
export function isMemberSilent(
  member: DeviceGroupMemberHealth,
  pipelineUnavailable: boolean,
  now: number,
): boolean {
  if (member.deviceType === "mobile" || pipelineUnavailable) {
    return false;
  }
  if (member.connectivity?.connected !== true) {
    return false;
  }
  return (
    member.lastDataAt === null || now - new Date(member.lastDataAt).getTime() > SILENT_THRESHOLD_MS
  );
}

export function summarizeGroupHealth(
  members: DeviceGroupMemberHealth[],
  pipelineUnavailable: boolean,
  now: number,
): GroupHealthSummary {
  return {
    total: members.length,
    online: members.filter((member) => member.connectivity?.connected === true).length,
    unknown: members.filter((member) => member.connectivity === null).length,
    silent: members.filter((member) => isMemberSilent(member, pipelineUnavailable, now)).length,
  };
}
