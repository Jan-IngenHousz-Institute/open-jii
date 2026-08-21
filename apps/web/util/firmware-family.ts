import { zFirmwareFamily } from "@repo/api/domains/iot/firmware/iot-firmware.schema";
import type { FirmwareFamily } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

/**
 * Whether JII builds and publishes firmware for this device family. Reads the
 * contract enum rather than a second list, so a new family is added in one
 * place.
 */
export function hasManagedFirmware(family: string): family is FirmwareFamily {
  return zFirmwareFamily.safeParse(family).success;
}
