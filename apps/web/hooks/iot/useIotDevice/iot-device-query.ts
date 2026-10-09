import type { QueryUtils } from "@/lib/orpc";

/** The device query, built the same way for the hook and for the server that prefetches it. */
export function iotDeviceQuery(
  utils: QueryUtils,
  deviceId: string,
  opts?: { refetchInterval?: number },
) {
  return utils.iot.getIotDevice.queryOptions({
    input: { deviceId },
    refetchInterval: opts?.refetchInterval,
  });
}
