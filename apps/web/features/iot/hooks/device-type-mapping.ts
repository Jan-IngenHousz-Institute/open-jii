import type { SensorFamily } from "@repo/api/schemas/protocol.schema";
import type { DeviceType } from "@repo/iot";

/**
 * Map a SensorFamily to the corresponding IoT DeviceType.
 * Falls back to "generic" for unknown families.
 *
 * This mapping lives in the web layer (not in @repo/iot core)
 * because SensorFamily is an app-level concept from @repo/api.
 */
export function sensorFamilyToDeviceType(sensorFamily: SensorFamily): DeviceType {
  switch (sensorFamily) {
    case "multispeq":
      return "multispeq";
    default:
      return "generic";
  }
}
