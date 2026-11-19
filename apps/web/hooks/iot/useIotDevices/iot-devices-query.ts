import type { QueryUtils } from "@/lib/orpc";

import { listItems } from "@repo/api/shared/listing";

/** The user's devices, built the same way for the hook and for the server that prefetches them. */
export function iotDevicesQuery(utils: QueryUtils) {
  return utils.iot.listIotDevices.queryOptions({
    input: {},
    select: (response) => listItems(response),
  });
}
