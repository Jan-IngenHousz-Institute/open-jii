import type { IotDeviceGroupMemberHealth } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

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
  member: IotDeviceGroupMemberHealth,
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

export type MemberStatus = "online" | "offline" | "unknown";

export function memberStatus(member: IotDeviceGroupMemberHealth): MemberStatus {
  if (member.connectivity === null) return "unknown";
  return member.connectivity.connected ? "online" : "offline";
}

export type MemberStatusFilter = MemberStatus | "silent" | "all";

export interface MemberFilter {
  search: string;
  status: MemberStatusFilter;
}

/**
 * Case-insensitive name/serial search plus one status chip. Silence is a flag
 * on top of "online", so it filters as its own chip rather than a fourth state.
 */
export function filterGroupMembers(
  members: IotDeviceGroupMemberHealth[],
  filter: MemberFilter,
  pipelineUnavailable: boolean,
  now: number,
  labelFor: (member: IotDeviceGroupMemberHealth) => string,
): IotDeviceGroupMemberHealth[] {
  const needle = filter.search.trim().toLowerCase();

  return members.filter((member) => {
    if (needle !== "") {
      const haystack = `${labelFor(member)} ${member.serialNumber}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (filter.status === "all") return true;
    if (filter.status === "silent") return isMemberSilent(member, pipelineUnavailable, now);
    return memberStatus(member) === filter.status;
  });
}

export function summarizeGroupHealth(
  members: IotDeviceGroupMemberHealth[],
  pipelineUnavailable: boolean,
  now: number,
): GroupHealthSummary {
  return {
    total: members.length,
    online: members.filter((member) => memberStatus(member) === "online").length,
    unknown: members.filter((member) => memberStatus(member) === "unknown").length,
    silent: members.filter((member) => isMemberSilent(member, pipelineUnavailable, now)).length,
  };
}
