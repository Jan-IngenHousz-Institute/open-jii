import type { QueryUtils } from "@/lib/orpc";

/** The user's devices, built the same way for the hook and for the server that prefetches them. */
export function iotDevicesQuery(utils: QueryUtils) {
  return utils.iot.listIotDevices.queryOptions();
}
