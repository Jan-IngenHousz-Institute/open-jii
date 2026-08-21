import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { FirmwareFamily } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

/** Published firmware releases for a family, as the platform sees them. */
export const useIotFirmwareReleases = (family: FirmwareFamily) =>
  useQuery(orpc.iot.listIotFirmwareReleases.queryOptions({ input: { family } }));
