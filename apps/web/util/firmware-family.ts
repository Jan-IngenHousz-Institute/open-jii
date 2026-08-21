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

/**
 * Devices report the firmware version their build was stamped with, while a
 * release is addressed by its git tag, and the two differ by a leading `v`
 * depending on how the image was built. Comparison strips that prefix only:
 * a dirty build like `1.3.0-2-gabc123` must still read as "not the release".
 */
export function isSameFirmwareVersion(reported: string, releaseTag: string): boolean {
  const strip = (value: string) => value.trim().replace(/^v/i, "");
  return strip(reported) === strip(releaseTag);
}
