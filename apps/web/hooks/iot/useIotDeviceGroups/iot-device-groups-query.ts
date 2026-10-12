import type { QueryUtils } from "@/lib/orpc";

/** The user's device groups, built the same way for the hook and for the server. */
export function iotDeviceGroupsQuery(utils: QueryUtils) {
  return utils.iot.listIotDeviceGroups.queryOptions();
}
