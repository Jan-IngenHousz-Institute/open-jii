import type { QueryUtils } from "@/lib/orpc";

/** The group query, built the same way for the hook and for the server that prefetches it. */
export function iotDeviceGroupQuery(utils: QueryUtils, groupId: string) {
  return utils.iot.getIotDeviceGroup.queryOptions({ input: { groupId } });
}
