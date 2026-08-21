import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { FirmwareFamily } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

/**
 * Published firmware releases for a family, as the platform sees them.
 * `enabled` lets a caller hold the request until it knows the device's family.
 */
export const useIotFirmwareReleases = (family: FirmwareFamily, options?: { enabled?: boolean }) =>
  useQuery({
    ...orpc.iot.listIotFirmwareReleases.queryOptions({ input: { family } }),
    enabled: options?.enabled ?? true,
  });
