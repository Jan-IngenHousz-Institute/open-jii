import { getOrpcError, orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { FirmwareFamily } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

/**
 * Published firmware releases for a family, as the platform sees them.
 * `enabled` lets a caller hold the request until it knows the device's family.
 */
export const useIotFirmwareReleases = (family: FirmwareFamily, options?: { enabled?: boolean }) =>
  useQuery(
    orpc.iot.listIotFirmwareReleases.queryOptions({
      input: { family },
      enabled: options?.enabled ?? true,
      retry(failureCount, error) {
        // A family with no repository configured settles at 404; retrying a
        // configuration gap only delays the answer.
        if (getOrpcError(error)?.status === 404) {
          return false;
        }
        return failureCount < 2;
      },
    }),
  );
